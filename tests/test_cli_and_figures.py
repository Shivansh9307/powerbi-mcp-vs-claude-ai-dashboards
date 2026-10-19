"""The command line and the image builder."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image
from typer.testing import CliRunner

from f1evo.cli import app
from f1evo.data import profile_all
from f1evo.figures import before_after
from tests.conftest import EXPECTED_ANCHORS

runner = CliRunner()


@pytest.fixture
def expected_file(raw_dir: Path, tmp_path: Path) -> Path:
    files = {p.name: {k: v for k, v in p.as_dict().items() if k != "name"} for p in profile_all(raw_dir)}
    path = tmp_path / "expected.json"
    path.write_text(json.dumps({"anchors": EXPECTED_ANCHORS, "files": files}), encoding="utf-8")
    return path


def test_anchors_command_passes_on_matching_data(raw_dir: Path, expected_file: Path) -> None:
    result = runner.invoke(app, ["anchors", "--raw", str(raw_dir), "--expected", str(expected_file)])
    assert result.exit_code == 0, result.output
    assert "DIFFERS" not in result.output


def test_anchors_command_fails_when_a_number_differs(raw_dir: Path, expected_file: Path) -> None:
    data = json.loads(expected_file.read_text(encoding="utf-8"))
    data["anchors"]["wins"] = 999
    expected_file.write_text(json.dumps(data), encoding="utf-8")
    result = runner.invoke(app, ["anchors", "--raw", str(raw_dir), "--expected", str(expected_file)])
    assert result.exit_code == 1
    assert "DIFFERS" in result.output


def test_data_check_command_passes_and_fails(raw_dir: Path, expected_file: Path) -> None:
    ok = runner.invoke(app, ["data", "check", "--raw", str(raw_dir), "--expected", str(expected_file)])
    assert ok.exit_code == 0, ok.output
    (raw_dir / "status.csv").write_text("statusId,note\n1,x\n2,y\n", encoding="utf-8")
    bad = runner.invoke(app, ["data", "check", "--raw", str(raw_dir), "--expected", str(expected_file)])
    assert bad.exit_code == 1
    assert "DIFFERS" in bad.output


def test_missing_expected_file_is_exit_code_2(raw_dir: Path, tmp_path: Path) -> None:
    result = runner.invoke(app, ["anchors", "--raw", str(raw_dir), "--expected", str(tmp_path / "nope.json")])
    assert result.exit_code == 2


def test_version_command() -> None:
    assert runner.invoke(app, ["version"]).output.strip() == "0.1.0"


def test_before_after_image_has_the_expected_size(tmp_path: Path) -> None:
    for name, colour in (("before", (200, 30, 30)), ("after", (245, 179, 1))):
        Image.new("RGB", (3510, 1500), colour).save(tmp_path / f"{name}.png")
    out = before_after(tmp_path / "before.png", tmp_path / "after.png", tmp_path / "out" / "x.png")
    assert Image.open(out).size == (2400, 1254)


def test_pbip_check_command_passes_on_the_real_project() -> None:
    repo = Path(__file__).resolve().parents[1]
    result = runner.invoke(app, ["pbip", "check", str(repo / "powerbi")])
    assert result.exit_code == 0, result.output
    assert "0 errors" in result.output


def test_figures_command_writes_the_image(tmp_path: Path) -> None:
    for name in ("before", "after"):
        Image.new("RGB", (3510, 1500), (15, 17, 21)).save(tmp_path / f"{name}.png")
    out = tmp_path / "x.png"
    args = ["figures", "before-after", "--before", str(tmp_path / "before.png"), "--after", str(tmp_path / "after.png")]
    result = runner.invoke(app, [*args, "--out", str(out)])
    assert result.exit_code == 0, result.output
    assert out.is_file()
