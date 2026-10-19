"""Shared fixtures: a tiny synthetic Formula 1 dataset whose answers can be worked out by hand.

Season 2020 has two races, both with results (complete). Season 2021 has two races but only the
first has results (a season in progress). The cases below are chosen to exercise every rule:

====== ===== ====== ====== ==========================================================
race   year  driver team   positionText  what it tests
====== ===== ====== ====== ==========================================================
1      2020  d1     c1     1             a win
1      2020  d2     c2     2             a podium
1      2020  d3     c2     F             failed to qualify: not a start
2      2020  d2     c2     1             a win
2      2020  d1     c1     R             retired: still a start
2      2020  d4     c3     W             withdrew: not a start
3      2021  d1     c1     1             a win in the season in progress
3      2021  d2     c2     D             disqualified: still a start
3      2021  d1     c4     1             shared drive: same driver and race twice
====== ===== ====== ====== ==========================================================

Expected: 3 races held, 2 drivers started (d3 and d4 never did), 3 constructors started (c3 never
did), 2 circuits, 4 wins, one driver title and one constructor title (2020 only).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from f1evo.data import NULL_MARKER, RAW_FILES

EXPECTED_ANCHORS = {
    "races": 3,
    "drivers": 2,
    "constructors": 3,
    "circuits": 2,
    "wins": 4,
    "driver_titles": 1,
    "constructor_titles": 1,
}


def _write(raw: Path, name: str, columns: list[str], rows: list[list[object]]) -> None:
    frame = pd.DataFrame(rows, columns=columns).fillna(NULL_MARKER)
    frame.to_csv(raw / f"{name}.csv", index=False)


@pytest.fixture
def raw_dir(tmp_path: Path) -> Path:
    """A folder with all 14 raw files: real content for the ones the rules read, stubs for the rest."""
    raw = tmp_path / "raw"
    raw.mkdir()
    _write(
        raw,
        "races",
        ["raceId", "year", "round", "circuitId", "name", "date"],
        [
            [1, 2020, 1, 1, "A GP", "2020-03-01"],
            [2, 2020, 2, 2, "B GP", "2020-03-15"],
            [3, 2021, 1, 1, "A GP", "2021-03-01"],
            [4, 2021, 2, 3, "C GP", "2021-03-15"],
        ],
    )
    none = None
    _write(
        raw,
        "results",
        ["resultId", "raceId", "driverId", "constructorId", "position", "positionText"],
        [
            [1, 1, "d1", "c1", 1, "1"],
            [2, 1, "d2", "c2", 2, "2"],
            [3, 1, "d3", "c2", none, "F"],
            [4, 2, "d2", "c2", 1, "1"],
            [5, 2, "d1", "c1", none, "R"],
            [6, 2, "d4", "c3", none, "W"],
            [7, 3, "d1", "c1", 1, "1"],
            [8, 3, "d2", "c2", none, "D"],
            [9, 3, "d1", "c4", 1, "1"],
        ],
    )
    _write(
        raw,
        "driver_standings",
        ["raceId", "driverId", "points", "position"],
        [
            [1, "d1", 25, 1], [1, "d2", 18, 2],
            [2, "d2", 43, 1], [2, "d1", 25, 2],
            [3, "d1", 25, 1],
        ],
    )  # fmt: skip
    _write(
        raw,
        "constructor_standings",
        ["raceId", "constructorId", "points", "position"],
        [
            [1, "c1", 25, 1], [1, "c2", 18, 2],
            [2, "c2", 43, 1], [2, "c1", 25, 2],
            [3, "c1", 25, 1],
        ],
    )  # fmt: skip
    for name, key in RAW_FILES.items():
        if not (raw / f"{name}.csv").exists():
            columns = [*(key or ["id"]), "note"]
            _write(raw, name, columns, [[*range(len(columns) - 1), none]])
    return raw
