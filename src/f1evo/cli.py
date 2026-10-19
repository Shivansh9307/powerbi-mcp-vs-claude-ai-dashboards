"""Command line interface: ``f1evo data check | anchors | pbip check | figures before-after``."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer

from f1evo import __version__
from f1evo.anchors import ANCHOR_LABELS, compute_anchors
from f1evo.data import RawDataError, profile_all
from f1evo.figures import before_after, crop_captures
from f1evo.pbip import check_project

app = typer.Typer(
    help="Tools that verify the F1 Evolution Power BI report.", no_args_is_help=True, add_completion=False
)
data_app = typer.Typer(help="Check the raw CSV files.", no_args_is_help=True)
pbip_app = typer.Typer(help="Lint the Power BI project files.", no_args_is_help=True)
figures_app = typer.Typer(help="Rebuild documentation images.", no_args_is_help=True)
app.add_typer(data_app, name="data")
app.add_typer(pbip_app, name="pbip")
app.add_typer(figures_app, name="figures")

RawDir = Annotated[
    Path, typer.Option("--raw", "-r", exists=True, file_okay=False, help="Folder with the raw CSV files.")
]
ExpectedFile = Annotated[Path, typer.Option("--expected", "-e", help="Expected values (JSON).")]
DEFAULT_EXPECTED = Path("data/expected.json")


def _load_expected(path: Path) -> dict[str, dict[str, dict[str, int] | int]]:
    if not path.is_file():
        typer.echo(f"Expected-values file not found: {path}", err=True)
        raise typer.Exit(2)
    loaded: dict[str, dict[str, dict[str, int] | int]] = json.loads(path.read_text(encoding="utf-8"))
    return loaded


@app.callback(invoke_without_command=False)
def _root() -> None:
    """F1 Evolution tooling."""


@app.command()
def version() -> None:
    """Print the package version."""
    typer.echo(__version__)


@data_app.command("check")
def data_check(raw: RawDir, expected: ExpectedFile = DEFAULT_EXPECTED) -> None:
    """Profile every raw file and compare it with the values the Data Quality page shows."""
    want = _load_expected(expected)["files"]
    try:
        profiles = profile_all(raw)
    except RawDataError as error:
        typer.echo(str(error), err=True)
        raise typer.Exit(2) from error
    failures = 0
    typer.echo(f"{'file':24}{'rows':>10}{'null cells':>12}{'dup keys':>10}  status")
    for p in profiles:
        exp = want.get(p.name)
        ok = isinstance(exp, dict) and exp == {k: v for k, v in p.as_dict().items() if k != "name"}
        failures += 0 if ok else 1
        typer.echo(
            f"{p.name:24}{p.rows:>10,}{p.null_cells:>12,}{p.duplicate_key_rows:>10,}  {'ok' if ok else 'DIFFERS'}"
        )
    typer.echo(f"\n{len(profiles) - failures}/{len(profiles)} files match {expected}")
    raise typer.Exit(1 if failures else 0)


@app.command()
def anchors(raw: RawDir, expected: ExpectedFile = DEFAULT_EXPECTED) -> None:
    """Recompute the report's headline numbers from the raw CSVs and compare with Power BI."""
    want = _load_expected(expected)["anchors"]
    try:
        got = compute_anchors(raw)
    except RawDataError as error:
        typer.echo(str(error), err=True)
        raise typer.Exit(2) from error
    failures = 0
    for key, label in ANCHOR_LABELS.items():
        ok = want.get(key) == got[key]
        failures += 0 if ok else 1
        typer.echo(f"{'ok' if ok else 'DIFFERS':8}{got[key]:>7,}  (expected {want.get(key)})  {label}")
    raise typer.Exit(1 if failures else 0)


@pbip_app.command("check")
def pbip_check(
    path: Annotated[
        Path, typer.Argument(exists=True, file_okay=False, help="Folder that holds the .pbip file.")
    ] = Path("powerbi"),
    verbose: Annotated[bool, typer.Option("--verbose", "-v", help="List every warning.")] = False,
) -> None:
    """Check measures are documented, visuals reference real fields, and no private paths remain."""
    report = check_project(path)
    stats = ", ".join(f"{v:,} {k}" for k, v in report.stats.items())
    typer.echo(f"Project: {stats}")
    for finding in report.errors:
        typer.echo(str(finding))
    shown = report.warnings if verbose else report.warnings[:5]
    for finding in shown:
        typer.echo(str(finding))
    if len(report.warnings) > len(shown):
        typer.echo(f"... and {len(report.warnings) - len(shown)} more warnings (use --verbose)")
    typer.echo(f"{len(report.errors)} errors, {len(report.warnings)} warnings")
    raise typer.Exit(1 if report.errors else 0)


@figures_app.command("crop-captures")
def figures_crop_captures(
    src: Annotated[Path, typer.Option(exists=True, file_okay=False, help="Folder of Desktop captures.")],
    out: Annotated[Path, typer.Option(help="Where to write the cropped, renamed pages.")],
) -> None:
    """Crop Power BI Desktop captures to the report page and give them stable lowercase names."""
    written = crop_captures(src, out)
    typer.echo(f"Wrote {len(written)} images to {out}")
    raise typer.Exit(0 if written else 1)


@figures_app.command("before-after")
def figures_before_after(
    before: Annotated[Path, typer.Option(exists=True, dir_okay=False)] = Path("docs/images/before/01-overview.png"),
    after: Annotated[Path, typer.Option(exists=True, dir_okay=False)] = Path("docs/images/after/01-overview.png"),
    out: Annotated[Path, typer.Option()] = Path("docs/images/before_after_overview.png"),
) -> None:
    """Compose the side-by-side Overview image used on the README."""
    typer.echo(f"Wrote {before_after(before, after, out)}")


def main() -> None:
    """Console-script entry point."""
    app()
