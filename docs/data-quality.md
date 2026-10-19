# Data quality: what was wrong, how it was found, how it is checked now

The first AI-generated report looked finished and was wrong in ways a stakeholder would have caught in a meeting. This
document is the audit that found them, the fixes, and the checks that keep them fixed.

## The finding that started it
Two builds of the same dashboard from the same data (this Power BI report and a Claude artifact) disagreed on three headline
numbers. Neither was "the right one" until the definitions were agreed.

| Number | Power BI v0 | Artifact | Cause |
|---|---:|---:|---|
| Drivers | 865 | 790 | v0 counted every result row, including cars that never started |
| Constructors | 213 | 199 | same |
| Titles | 146 (77 + 69) | 144 (76 + 68) | v0 counted the 2026 leaders as champions with 17 of 23 races run |

The measures were **correct for what they calculated**. The labels were wrong, and a season in progress was treated as a
finished one. The rest of this page is what that cost to untangle.

## Phase 0 audit: defects found before building the other six pages (rows 1 to 7 of the [defect log](defect-log.md))
| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | Drivers and Constructors counted every result row | 865 / 213; 1,714 of 27,612 rows have position code `F` or `W` | `Status Group` and `Started` columns; `# Drivers Started` and `# Constructors Started` count starters: 790 / 199 |
| 2 | Titles included the season in progress | 2026 has 17 of 23 races with results | `Season[Is Complete]` (races with results equal races scheduled; no hard-coded year). Titles count completed seasons only: 76 + 68. A season in progress shows "(leader)" |
| 3 | `Finish Position` filled for non-classified rows | 126 rows in 2025 to 2026 (R 110, W 10, D 6) have a numeric position but a non-numeric position text | Finish position follows the position text; classified finishes were being overstated |
| 4 | A pole counted any `Grid = 1` row, and grid 0 was unexplained | 1,638 rows have grid 0 | Poles count starters only; grid 0 shows "Pit lane / unrecorded" and a missing grid "Not recorded" |
| 5 | Lap data had duplicate rows | 1,979 repeated (race, driver, lap) rows | Removed in Power Query: 883,402 rows kept |
| 6 | Pit Stops and Lap Times had no constructor link | The constructor slicer could not filter them | `Constructor Id` merged from the race result; relationships added |
| 7 | Qualifying times were text only | Q1 to Q3 held as "m:ss.000" | Millisecond columns and a best-time column added |

Findings 8 to 14 came during the build of pages 2 to 8: a misleading negative pit-time gap, a coverage heat map that hid
missing tables, head-to-head wins that showed blank instead of zero, and a measure that errored on a Boolean `MAX`. Only
those four are documented. All defects, de-duplicated and numbered 1 to 19 with the gap in the record stated, are in
[`defect-log.md`](defect-log.md).

## How the Data Quality page works (page 8)
Nothing on it is typed. Row counts, duplicate keys and null cells come from Power Query profiling of the raw files
(`DQ Raw Profile`) and from measures over the loaded model (`DQ Tables`, `DQ Columns`).

| Check | Result |
|---|---|
| Tables passing integrity checks | **13 of 15** |
| Race Results | **Warn**: 91 duplicate race and driver keys. Cause: shared drives, where one driver appears twice in a race (for example position text "R,3,2"). Kept and flagged, not removed |
| Sprint Results | **Fail**: 2 rows with no status recorded (position code `W`) belonging to the last scheduled round. Reported, not hidden |
| `lap_times.csv` | 885,381 raw rows, 1,979 duplicates removed in Power Query, 883,402 loaded |
| Official standings vs recorded points | Agree from 1994; differ in early seasons where championships counted only each driver's best results (1950: 164 official vs 168 recorded) |
| Coverage by season and table | Single-hue heat map: lap times from 1982, pit stops and qualifying from 1994, sprints from 2021, constructor standings from 1958 |
| Missing values | Listed per column; the source marker `\N` loads as blank and is never turned into zero |

Pass, Warn and Fail are always printed as words. Status colours are neutral (grey, amber, white) so the page does not depend on
telling red from green.

## Independent verification outside Power BI
`f1evo` re-reads the raw CSVs with pandas and reproduces the numbers the Data Quality page shows, so a reviewer does not
have to trust the DAX or open Power BI:

```powershell
uv run f1evo data check --raw data/raw
```
```
file                          rows  null cells  dup keys  status
lap_times                  885,381           0     1,979  ok
results                     27,612     124,661        91  ok
...
14/14 files match data\expected.json
```
```powershell
uv run f1evo anchors --raw data/raw
```
```
ok        1,166  (expected 1166)  Grands Prix held (races with at least one start)
ok          790  (expected 790)  Drivers who started at least one race
ok          199  (expected 199)  Constructors with at least one start
ok           78  (expected 78)  Circuits that hosted a race
ok        1,169  (expected 1169)  Victories (a shared drive credits each driver)
ok           76  (expected 76)  Drivers' titles, completed seasons only
ok           68  (expected 68)  Constructors' titles, completed seasons only
```

## What I would do differently
- Write the metric definitions **before** the first measure. Every defect in the audit is a definition problem
  ("what is a driver?", "is a title still a title in October?"), not a DAX problem.
- Put the reconciliation script in the repo on day one. It was built after the audit and caught nothing the audit had missed,
  but it makes the claim checkable by someone else.
- Keep `data/expected.json` under review: if the source CSVs are refreshed, the expected values change deliberately, in a
  commit that says why.
