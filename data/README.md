# Data

The report reads 14 Ergast-layout Formula 1 CSV files. They are **not in this repository** (size, and the data licence
in `NOTICE.md`). Put your copy in `data/raw/` (the folder is gitignored).

**Source of the copy used here:** the Kaggle dataset *Formula 1 Race Data*
(<https://www.kaggle.com/datasets/jtrotman/formula-1-race-data>), which follows the Ergast layout. Ergast data is published
under CC BY-NC-SA 3.0; this repository is non-commercial. The artifact's derived CSVs can be read by anyone who can open the
published artifact, so the same terms apply to them. See [`NOTICE.md`](../NOTICE.md).

## Files and expected sizes
Raw rows, cells holding the source's `\N` missing-value marker, and rows that repeat a business key. These are the
values the Data Quality page shows, and `f1evo data check` verifies them.

| File | Rows | `\N` cells | Duplicate-key rows |
|---|---:|---:|---:|
| circuits.csv | 78 | 0 | 0 |
| constructor_results.csv | 13,052 | 13,035 | 0 |
| constructor_standings.csv | 13,818 | 1 | 0 |
| constructors.csv | 214 | 0 | 0 |
| driver_standings.csv | 35,741 | 13 | 0 |
| drivers.csv | 865 | 1,559 | 0 |
| lap_times.csv | 885,381 | 0 | 1,979 (removed in Power Query) |
| pit_stops.csv | 22,802 | 6 | 0 |
| qualifying.csv | 11,342 | 12,349 | 0 |
| races.csv | 1,172 | 11,479 | 0 |
| results.csv | 27,612 | 124,661 | 91 (shared drives, kept and flagged) |
| seasons.csv | 77 | 0 | 0 |
| sprint_results.csv | 612 | 532 | 0 |
| status.csv | 141 | 0 | 0 |

Your copy may be newer than the one used here; if so the numbers will differ and `data/expected.json` should be updated
(see `docs/testing-and-qa.md`).

## Check your copy
```powershell
uv sync
uv run f1evo data check --raw data/raw      # 14/14 files match
uv run f1evo anchors --raw data/raw         # recomputes the seven headline numbers independently of Power BI
```

## Point the report at it
1. Open `powerbi/F1 Dataset.pbip` in Power BI Desktop.
2. Home > Transform data > Edit parameters > set **F1 CSV Folder** to the full path of `data/raw`.
3. Close & Apply, then Refresh. Do not edit the model while it refreshes (see `docs/lessons-desktop-stalls.md`).
