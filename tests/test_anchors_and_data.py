"""The independent recomputation and the raw-file profile, against hand-worked answers."""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import pytest

from f1evo.anchors import completed_seasons, compute_anchors, mark_results
from f1evo.data import RawDataError, profile_file, read_raw
from tests.conftest import EXPECTED_ANCHORS


def test_missing_marker_becomes_missing_not_zero(raw_dir: Path) -> None:
    results = read_raw(raw_dir, "results")
    assert results["position"].isna().sum() == 4
    assert (results["position"] == 0).sum() == 0


def test_missing_file_is_a_clear_error(tmp_path: Path) -> None:
    with pytest.raises(RawDataError, match="Missing raw file"):
        read_raw(tmp_path, "results")


def test_failed_to_qualify_and_withdrawn_are_not_starts(raw_dir: Path) -> None:
    marked = mark_results(read_raw(raw_dir, "results"))
    assert marked.loc[marked["positionText"].isin(["F", "W"]), "started"].sum() == 0
    assert marked.loc[marked["positionText"].isin(["R", "D", "1", "2"]), "started"].all()


def test_finish_position_comes_from_position_text(raw_dir: Path) -> None:
    marked = mark_results(read_raw(raw_dir, "results"))
    assert marked["finish_position"].dropna().tolist() == [1, 2, 1, 1, 1]
    assert marked.loc[marked["positionText"] == "R", "finish_position"].isna().all()


def test_a_season_in_progress_is_not_complete(raw_dir: Path) -> None:
    races = read_raw(raw_dir, "races")
    results = read_raw(raw_dir, "results")
    assert completed_seasons(races, results) == {2020}


def test_anchors_match_hand_worked_answers(raw_dir: Path) -> None:
    assert compute_anchors(raw_dir) == EXPECTED_ANCHORS


def test_shared_drive_is_counted_once_as_a_race_and_twice_as_a_win(raw_dir: Path) -> None:
    anchors = compute_anchors(raw_dir)
    assert anchors["races"] == 3  # race 3 has two rows for d1 but is one race
    assert anchors["wins"] == 4  # both rows of the shared drive carry a win


def test_profile_counts_rows_nulls_and_duplicate_keys(raw_dir: Path) -> None:
    profile = profile_file(raw_dir, "results")
    assert (profile.rows, profile.null_cells, profile.duplicate_key_rows) == (9, 4, 1)
    assert profile_file(raw_dir, "races").duplicate_key_rows == 0


def test_profile_flags_repeated_laps(raw_dir: Path) -> None:
    laps = pd.DataFrame({"raceId": [1, 1, 1], "driverId": ["d1", "d1", "d1"], "lap": [1, 1, 2], "note": ["", "", ""]})
    laps.to_csv(raw_dir / "lap_times.csv", index=False)
    assert profile_file(raw_dir, "lap_times").duplicate_key_rows == 1


@pytest.mark.real_data
def test_real_data_reproduces_the_report_numbers() -> None:
    raw = os.environ.get("F1_RAW_DIR")
    if not raw:
        pytest.skip("set F1_RAW_DIR to the folder with the raw CSV files")
    assert compute_anchors(Path(raw)) == {
        "races": 1166,
        "drivers": 790,
        "constructors": 199,
        "circuits": 78,
        "wins": 1169,
        "driver_titles": 76,
        "constructor_titles": 68,
    }
