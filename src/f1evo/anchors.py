"""Independent recomputation of the report's headline numbers.

Power BI computes these with DAX over the semantic model. This module recomputes them from the
raw files with pandas, using the definitions in ``docs/data-model.md``, so a reader can check the
report without opening Power BI. If the two ever disagree, one of them is wrong.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from f1evo.data import read_raw

#: Position texts that mean the entry never started: F = failed to qualify, W = withdrew.
NON_START_POSITION_TEXT = frozenset({"F", "W"})

ANCHOR_LABELS: dict[str, str] = {
    "races": "Grands Prix held (races with at least one start)",
    "drivers": "Drivers who started at least one race",
    "constructors": "Constructors with at least one start",
    "circuits": "Circuits that hosted a race",
    "wins": "Victories (a shared drive credits each driver)",
    "driver_titles": "Drivers' titles, completed seasons only",
    "constructor_titles": "Constructors' titles, completed seasons only",
}


def mark_results(results: pd.DataFrame) -> pd.DataFrame:
    """Add ``started`` and ``finish_position`` to a results table.

    ``finish_position`` comes from ``positionText`` (digits mean classified), not from the raw
    ``position`` column, which is also filled for some retired rows in recent seasons.
    """
    marked = results.copy()
    text = marked["positionText"].astype(str)
    marked["started"] = ~text.isin(NON_START_POSITION_TEXT)
    marked["finish_position"] = pd.to_numeric(text.where(text.str.fullmatch(r"\d+")), errors="coerce")
    return marked


def completed_seasons(races: pd.DataFrame, results: pd.DataFrame) -> set[int]:
    """Seasons whose scheduled races all have results. A season in progress is not complete."""
    with_results = races[races["raceId"].isin(results["raceId"].unique())]
    scheduled = races.groupby("year").size()
    held = with_results.groupby("year").size()
    return {int(y) for y in scheduled.index if held.get(y, 0) > 0 and held.get(y, 0) == scheduled[y]}


def _final_leaders(
    standings: pd.DataFrame, races: pd.DataFrame, results: pd.DataFrame, complete: set[int], entity: str
) -> int:
    """Count seasons whose last standings (after the final race with results) have a leader."""
    held = races[races["raceId"].isin(results["raceId"].unique())]
    last_race = held.sort_values(["year", "round"]).groupby("year").tail(1)
    last_race = last_race[last_race["year"].isin(complete)]
    final = standings.merge(last_race[["raceId", "year"]], on="raceId")
    leaders = final[final["position"] == 1]
    return int(leaders.groupby("year")[entity].nunique().shape[0])


def compute_anchors(raw_dir: Path) -> dict[str, int]:
    """Recompute the seven headline numbers from the raw files."""
    races = read_raw(raw_dir, "races")
    results = mark_results(read_raw(raw_dir, "results"))
    started = results[results["started"]]
    race_has_start = races["raceId"].isin(started["raceId"].unique())
    race_has_row = races["raceId"].isin(results["raceId"].unique())
    complete = completed_seasons(races, results)
    return {
        "races": int(race_has_start.sum()),
        "drivers": int(started["driverId"].nunique()),
        "constructors": int(started["constructorId"].nunique()),
        "circuits": int(races.loc[race_has_row, "circuitId"].nunique()),
        "wins": int((results["finish_position"] == 1).sum()),
        "driver_titles": _final_leaders(read_raw(raw_dir, "driver_standings"), races, results, complete, "driverId"),
        "constructor_titles": _final_leaders(
            read_raw(raw_dir, "constructor_standings"), races, results, complete, "constructorId"
        ),
    }
