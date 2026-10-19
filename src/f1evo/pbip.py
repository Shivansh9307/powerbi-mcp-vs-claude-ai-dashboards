"""Static checks for the Power BI project (PBIP: PBIR report + TMDL semantic model).

Power BI Desktop does not validate several things this report depends on: a visual that points at
a measure someone renamed, a measure without documentation, or a machine-specific path left in a
file. These checks run in CI and before every commit, without opening Power BI.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SCHEMA_URL_PREFIX = "https://developer.microsoft.com/json-schemas/fabric/"
PERSONAL_PATH = re.compile(r"[A-Za-z]:\\+Users\\+[^\\\"']+", re.IGNORECASE)
#: Visual types that are layout furniture and need no data binding or alt text of their own.
FURNITURE_TYPES = frozenset({"shape", "image"})


class ProjectError(Exception):
    """Raised when the folder does not hold a usable PBIP project."""


@dataclass(frozen=True)
class Finding:
    """One result of a check. ``error`` fails CI; ``warning`` is reported only."""

    severity: str
    rule: str
    message: str
    path: str = ""

    def __str__(self) -> str:
        where = f" [{self.path}]" if self.path else ""
        return f"{self.severity.upper():7} {self.rule}: {self.message}{where}"


@dataclass
class ModelFacts:
    """What the semantic model contains, parsed from the TMDL files."""

    tables: set[str] = field(default_factory=set)
    columns: set[tuple[str, str]] = field(default_factory=set)
    measures: dict[tuple[str, str], dict[str, Any]] = field(default_factory=dict)
    relationships: int = 0

    def has_field(self, table: str, name: str) -> bool:
        return (table, name) in self.columns or (table, name) in self.measures


@dataclass
class Report:
    """Everything a check run found and counted."""

    findings: list[Finding] = field(default_factory=list)
    stats: dict[str, int] = field(default_factory=dict)

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "warning"]


def _unquote(token: str) -> str:
    """Read a TMDL object name: bare identifier or single-quoted with doubled quotes."""
    token = token.strip()
    if token.startswith("'"):
        end = 1
        while end < len(token):
            if token[end] == "'":
                if end + 1 < len(token) and token[end + 1] == "'":
                    end += 2
                    continue
                break
            end += 1
        return token[1:end].replace("''", "'")
    return re.split(r"[\s=]", token, maxsplit=1)[0]


def parse_model(definition_dir: Path) -> ModelFacts:
    """Parse tables, columns, measures and relationships from a TMDL ``definition`` folder."""
    facts = ModelFacts()
    for tmdl in sorted((definition_dir / "tables").glob("*.tmdl")):
        lines = tmdl.read_text(encoding="utf-8-sig").replace("\r\n", "\n").split("\n")
        table = ""
        for index, line in enumerate(lines):
            if line.startswith("table "):
                table = _unquote(line[len("table ") :])
                facts.tables.add(table)
            elif line.startswith("\tcolumn "):
                facts.columns.add((table, _unquote(line[len("\tcolumn ") :])))
            elif line.startswith("\tmeasure "):
                name = _unquote(line[len("\tmeasure ") :])
                block: list[str] = []
                cursor = index + 1
                while cursor < len(lines) and lines[cursor] != "":
                    block.append(lines[cursor])
                    cursor += 1
                facts.measures[(table, name)] = {
                    "documented": index > 0 and lines[index - 1].startswith("\t///"),
                    "folder": any("displayFolder:" in b for b in block),
                    "hidden": any(b.strip() == "isHidden" for b in block),
                    "expression": line + "\n" + "\n".join(block),
                    "file": tmdl.name,
                }
    relationships = definition_dir / "relationships.tmdl"
    if relationships.is_file():
        text = relationships.read_text(encoding="utf-8-sig")
        facts.relationships = len(re.findall(r"^relationship ", text, flags=re.MULTILINE))
    return facts


def _field_refs(node: Any, aliases: dict[str, str] | None = None) -> Iterator[tuple[str, str, str]]:
    """Yield ``(kind, entity, property)`` for every measure or column reference in a visual."""
    aliases = aliases or {}
    if isinstance(node, dict):
        if isinstance(node.get("From"), list):
            aliases = {**aliases, **{f["Name"]: f["Entity"] for f in node["From"] if "Name" in f and "Entity" in f}}
        for kind in ("Measure", "Column"):
            ref = node.get(kind)
            if isinstance(ref, dict) and "Property" in ref:
                source = ref.get("Expression", {}).get("SourceRef", {})
                entity = source.get("Entity") or aliases.get(source.get("Source", ""), "")
                if entity:
                    yield kind, entity, ref["Property"]
        for value in node.values():
            yield from _field_refs(value, aliases)
    elif isinstance(node, list):
        for item in node:
            yield from _field_refs(item, aliases)


def _scan_privacy(root: Path, report: Report) -> None:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in {".json", ".tmdl", ".pbip", ".pbir", ".platform"}:
            continue
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        match = PERSONAL_PATH.search(text)
        if match:
            report.findings.append(
                Finding("error", "PRIV001", f"machine-specific path {match.group(0)!r}", str(path.relative_to(root)))
            )


def _check_shell(root: Path, report: Report) -> tuple[Path, Path]:
    pbips = sorted(root.glob("*.pbip"))
    if len(pbips) != 1:
        raise ProjectError(f"expected exactly one .pbip in {root}, found {len(pbips)}")
    pbip = pbips[0]
    stem = pbip.stem
    report_dir, model_dir = root / f"{stem}.Report", root / f"{stem}.SemanticModel"
    for needed in (report_dir, model_dir):
        if not needed.is_dir():
            report.findings.append(Finding("error", "PBIP002", f"missing folder {needed.name} next to {pbip.name}"))
    for shell in (pbip, report_dir / "definition.pbir"):
        if shell.is_file():
            schema = json.loads(shell.read_text(encoding="utf-8-sig")).get("$schema", "")
            if not str(schema).startswith(SCHEMA_URL_PREFIX):
                report.findings.append(
                    Finding("error", "PBIP003", "missing $schema (Power BI Desktop strips it on save)", shell.name)
                )
    return report_dir, model_dir


def check_project(root: Path) -> Report:
    """Run every check on the PBIP in ``root`` and return the findings and counts."""
    report = Report()
    report_dir, model_dir = _check_shell(root, report)
    definition = report_dir / "definition"
    facts = parse_model(model_dir / "definition")

    # Measures: documented, foldered, unique names.
    names = Counter(name for _, name in facts.measures)
    for (table, name), info in sorted(facts.measures.items()):
        where = f"{table}/{name}"
        if not info["documented"]:
            report.findings.append(Finding("error", "MDL001", "measure has no /// description", where))
        if not info["folder"] and not info["hidden"]:
            report.findings.append(Finding("error", "MDL002", "visible measure has no displayFolder", where))
        if names[name] > 1:
            report.findings.append(Finding("error", "MDL003", "measure name is not unique across the model", where))

    # Pages and visuals.
    pages_json = json.loads((definition / "pages" / "pages.json").read_text(encoding="utf-8-sig"))
    order: list[str] = pages_json["pageOrder"]
    if len(order) != len(set(order)):
        report.findings.append(Finding("error", "REP001", "pageOrder repeats a page id"))
    used: set[tuple[str, str]] = set()
    visuals = 0
    for page_id in order:
        page_dir = definition / "pages" / page_id
        if not (page_dir / "page.json").is_file():
            report.findings.append(Finding("error", "REP002", "pageOrder lists a page with no page.json", page_id))
            continue
        for vfile in sorted((page_dir / "visuals").glob("*/visual.json")):
            visuals += 1
            visual = json.loads(vfile.read_text(encoding="utf-8-sig"))
            where = f"{page_id}/{vfile.parent.name}"
            vtype = visual.get("visual", {}).get("visualType", "")
            alt = visual.get("visual", {}).get("visualContainerObjects", {}).get("general", [{}])[0]
            has_alt = "altText" in alt.get("properties", {}) if isinstance(alt, dict) else False
            if vtype not in FURNITURE_TYPES and not has_alt:
                report.findings.append(Finding("warning", "REP003", f"{vtype} has no alt text", where))
            for kind, entity, prop in _field_refs(visual):
                if entity not in facts.tables:
                    report.findings.append(Finding("error", "REP004", f"unknown table {entity!r}", where))
                elif not facts.has_field(entity, prop):
                    report.findings.append(
                        Finding("error", "REP005", f"unknown {kind.lower()} {entity}[{prop}]", where)
                    )
                elif kind == "Measure":
                    used.add((entity, prop))

    # Theme file referenced by the report exists.
    report_json = json.loads((definition / "report.json").read_text(encoding="utf-8-sig"))
    theme = report_json.get("themeCollection", {}).get("customTheme", {}).get("name")
    if theme and not (report_dir / "StaticResources" / "RegisteredResources" / theme).is_file():
        report.findings.append(Finding("error", "REP006", f"custom theme {theme} is referenced but missing"))

    # Measures nothing uses (neither a visual nor another measure): worth knowing about.
    for (table, name), info in sorted(facts.measures.items()):
        if (table, name) in used or info["hidden"]:
            continue
        needle = f"[{name}]"
        if not any(needle in other["expression"] for key, other in facts.measures.items() if key != (table, name)):
            report.findings.append(
                Finding("warning", "MDL004", "visible measure is not used anywhere", f"{table}/{name}")
            )

    _scan_privacy(root, report)
    report.stats = {
        "tables": len(facts.tables),
        "columns": len(facts.columns),
        "measures": len(facts.measures),
        "relationships": facts.relationships,
        "pages": len(order),
        "visuals": visuals,
    }
    return report
