"""Raw Ergast-style Formula 1 CSV loading and profiling.

The source marks missing values with the literal token ``\\N``. Every loader here turns that
token into a real missing value and never into zero, the same rule the Power BI model applies.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

NULL_MARKER = r"\N"

#: The 14 raw files the report reads, with the columns that identify one logical row.
#: ``None`` means the file has a surrogate key only and no business key to check.
RAW_FILES: dict[str, list[str] | None] = {
    "circuits": ["circuitId"],
    "constructor_results": ["raceId", "constructorId"],
    "constructor_standings": ["raceId", "constructorId"],
    "constructors": ["constructorId"],
    "driver_standings": ["raceId", "driverId"],
    "drivers": ["driverId"],
    "lap_times": ["raceId", "driverId", "lap"],
    "pit_stops": ["raceId", "driverId", "stop"],
    "qualifying": ["raceId", "driverId"],
    "races": ["raceId"],
    "results": ["raceId", "driverId"],
    "seasons": ["year"],
    "sprint_results": ["raceId", "driverId"],
    "status": ["statusId"],
}


class RawDataError(Exception):
    """Raised when a raw file is missing or unreadable."""


def read_raw(raw_dir: Path, name: str) -> pd.DataFrame:
    """Read one raw CSV, turning ``\\N`` into a missing value (never zero)."""
    path = raw_dir / f"{name}.csv"
    if not path.is_file():
        raise RawDataError(f"Missing raw file: {path}")
    return pd.read_csv(path, na_values=[NULL_MARKER], keep_default_na=False, encoding="utf-8-sig")


@dataclass(frozen=True)
class FileProfile:
    """What the Data Quality page reports for one raw file."""

    name: str
    rows: int
    null_cells: int
    duplicate_key_rows: int

    def as_dict(self) -> dict[str, int | str]:
        return {
            "name": self.name,
            "rows": self.rows,
            "null_cells": self.null_cells,
            "duplicate_key_rows": self.duplicate_key_rows,
        }


def profile_file(raw_dir: Path, name: str) -> FileProfile:
    """Profile one raw file: row count, missing-value cells and rows that repeat a business key.

    ``duplicate_key_rows`` counts the extra rows beyond the first for each repeated key, which
    is the number of rows the model drops (lap times) or keeps and flags (shared drives).
    """
    frame = read_raw(raw_dir, name)
    key = RAW_FILES[name]
    duplicates = int(frame.duplicated(subset=key, keep="first").sum()) if key else 0
    return FileProfile(
        name=name,
        rows=len(frame),
        null_cells=int(frame.isna().sum().sum()),
        duplicate_key_rows=duplicates,
    )


def profile_all(raw_dir: Path) -> list[FileProfile]:
    """Profile every raw file in a fixed order."""
    return [profile_file(raw_dir, name) for name in RAW_FILES]
