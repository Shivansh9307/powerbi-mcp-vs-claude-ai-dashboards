"""The PBIP lint: it must pass on the real project and fire on each kind of mistake."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from f1evo.pbip import ProjectError, check_project, parse_model

REPO = Path(__file__).resolve().parents[1]
SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/"

TMDL_OK = (
    "table T\n"
    "\t/// Total of everything.\n"
    "\tmeasure Total = 1\n"
    "\t\tformatString: 0\n"
    "\t\tdisplayFolder: Kpi\n"
    "\n"
    "\tcolumn Value\n"
)


def _visual(measure: str = "Total", alt: bool = True) -> dict[str, object]:
    visual: dict[str, object] = {
        "visualType": "card",
        "query": {
            "queryState": {
                "Values": {
                    "projections": [
                        {"field": {"Measure": {"Expression": {"SourceRef": {"Entity": "T"}}, "Property": measure}}}
                    ]
                }
            }
        },
    }
    if alt:
        visual["visualContainerObjects"] = {
            "general": [{"properties": {"altText": {"expr": {"Literal": {"Value": "'x'"}}}}}]
        }
    return {"$schema": SCHEMA + "visual", "name": "v1", "visual": visual}


@pytest.fixture
def project(tmp_path: Path) -> Path:
    """A minimal valid project: one table, one measure, one page, one visual."""
    root = tmp_path / "p"
    report, model = root / "X.Report", root / "X.SemanticModel"
    (report / "definition" / "pages" / "p1" / "visuals" / "v1").mkdir(parents=True)
    (model / "definition" / "tables").mkdir(parents=True)
    (root / "X.pbip").write_text(json.dumps({"$schema": SCHEMA + "pbip", "version": "1.0"}), encoding="utf-8")
    (report / "definition.pbir").write_text(
        json.dumps({"$schema": SCHEMA + "pbir", "version": "4.0"}), encoding="utf-8"
    )
    (report / "definition" / "report.json").write_text(json.dumps({"themeCollection": {}}), encoding="utf-8")
    (report / "definition" / "pages" / "pages.json").write_text(json.dumps({"pageOrder": ["p1"]}), encoding="utf-8")
    (report / "definition" / "pages" / "p1" / "page.json").write_text(json.dumps({"name": "p1"}), encoding="utf-8")
    (report / "definition" / "pages" / "p1" / "visuals" / "v1" / "visual.json").write_text(
        json.dumps(_visual()), encoding="utf-8"
    )
    (model / "definition" / "tables" / "T.tmdl").write_text(TMDL_OK, encoding="utf-8")
    return root


def _rules(root: Path) -> set[str]:
    return {f.rule for f in check_project(root).findings}


def test_valid_minimal_project_is_clean(project: Path) -> None:
    report = check_project(project)
    assert report.errors == []
    assert report.stats["measures"] == 1
    assert report.stats["visuals"] == 1


def test_undocumented_measure_is_an_error(project: Path) -> None:
    tmdl = project / "X.SemanticModel" / "definition" / "tables" / "T.tmdl"
    tmdl.write_text(TMDL_OK.replace("\t/// Total of everything.\n", ""), encoding="utf-8")
    assert "MDL001" in _rules(project)


def test_visible_measure_without_folder_is_an_error(project: Path) -> None:
    tmdl = project / "X.SemanticModel" / "definition" / "tables" / "T.tmdl"
    tmdl.write_text(TMDL_OK.replace("\t\tdisplayFolder: Kpi\n", ""), encoding="utf-8")
    assert "MDL002" in _rules(project)


def test_visual_pointing_at_a_renamed_measure_is_an_error(project: Path) -> None:
    vfile = project / "X.Report" / "definition" / "pages" / "p1" / "visuals" / "v1" / "visual.json"
    vfile.write_text(json.dumps(_visual(measure="Total (old name)")), encoding="utf-8")
    assert "REP005" in _rules(project)


def test_missing_alt_text_is_a_warning_not_an_error(project: Path) -> None:
    vfile = project / "X.Report" / "definition" / "pages" / "p1" / "visuals" / "v1" / "visual.json"
    vfile.write_text(json.dumps(_visual(alt=False)), encoding="utf-8")
    report = check_project(project)
    assert report.errors == []
    assert "REP003" in {f.rule for f in report.warnings}


def test_machine_specific_path_is_an_error(project: Path) -> None:
    tmdl = project / "X.SemanticModel" / "definition" / "tables" / "T.tmdl"
    tmdl.write_text(TMDL_OK + '\texpression Folder = "C:\\Users\\someone\\data"\n', encoding="utf-8")
    assert "PRIV001" in _rules(project)


def test_missing_schema_line_is_an_error(project: Path) -> None:
    (project / "X.pbip").write_text(json.dumps({"version": "1.0"}), encoding="utf-8")
    assert "PBIP003" in _rules(project)


def test_folder_without_a_pbip_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ProjectError):
        check_project(tmp_path)


def test_quoted_names_with_apostrophes_parse(tmp_path: Path) -> None:
    (tmp_path / "tables").mkdir()
    (tmp_path / "tables" / "Q.tmdl").write_text(
        "table 'Race Results'\n"
        "\t/// d\n"
        "\tmeasure 'Drivers'' Champion' = 1\n"
        "\t\tdisplayFolder: F\n"
        "\n"
        "\tcolumn 'Race Id'\n",
        encoding="utf-8",
    )
    facts = parse_model(tmp_path)
    assert ("Race Results", "Drivers' Champion") in facts.measures
    assert ("Race Results", "Race Id") in facts.columns


@pytest.mark.skipif(not (REPO / "powerbi").is_dir(), reason="powerbi/ folder not present")
def test_the_real_project_has_no_errors() -> None:
    report = check_project(REPO / "powerbi")
    assert report.errors == [], [str(e) for e in report.errors]
    assert report.stats["measures"] >= 200
    assert report.stats["pages"] == 11  # 8 report pages + 3 tooltip pages


@pytest.mark.skipif(not (REPO / "powerbi").is_dir(), reason="powerbi/ folder not present")
def test_lint_catches_a_renamed_measure_in_the_real_project(tmp_path: Path) -> None:
    copy = tmp_path / "powerbi"
    shutil.copytree(REPO / "powerbi", copy)
    tmdl = copy / "F1 Dataset.SemanticModel" / "definition" / "tables" / "Race Results.tmdl"
    text = tmdl.read_bytes().decode("utf-8")
    assert "measure Wins =" in text
    tmdl.write_bytes(text.replace("measure Wins =", "measure Victories Renamed =").encode("utf-8"))
    assert "REP005" in _rules(copy)
