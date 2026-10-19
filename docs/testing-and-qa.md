# Testing and QA

Four layers, from cheapest to most human. Each says what it proves and what it does not.

| Layer | Tool | Proves | Does not prove |
|---|---|---|---|
| 1. Project lint | `f1evo pbip check` (CI and pre-commit) | Every measure is documented and foldered; every visual points at an existing table, column or measure; alt text exists; the theme file exists; no machine path leaked; `$schema` present | That a measure is *right* |
| 2. Independent recomputation | `f1evo anchors`, `f1evo data check` | Seven headline numbers and the Data Quality figures reproduced from the raw CSVs in pandas | That every number on every page is right; only the anchors |
| 3. Measure tests at filter states | DAX through the modeling MCP, results tabulated | Each measure under 19 filter states, including impossible ones | Behaviour in a viewer's browser or on another machine |
| 4. Rendered review | Screenshots of every page and tooltip in Power BI Desktop | The layout, headlines and highlight colours look as intended | Cross-page behaviour of sync slicers and drill-through (loaded without errors; not scripted) |

## Layer 1: lint (what it catches in practice)
```powershell
uv run f1evo pbip check powerbi
```
```
Project: 25 tables, 159 columns, 200 measures, 28 relationships, 11 pages, 268 visuals
WARNING MDL004: visible measure is not used anywhere [...]
0 errors, 27 warnings
```
The checks that exist because of mistakes I made:
- **REP005** (a visual references a missing measure). Renaming a measure the open report used caused the first Desktop
  hang ("Something went wrong rendering the report"). The lint finds it in a second, without opening Desktop; a test renames
  `Wins` in a copy of the real project and expects the error.
- **MDL001, MDL002** (undocumented or unfoldered measure): consumers see the description in the field list and in Excel.
- **PRIV001** (machine-specific path): the model's CSV-folder parameter once held a personal path.
- **PBIP003** (`$schema` missing): Power BI Desktop strips it on save; Fabric rejects PBIR files without it.
- **REP003** (no alt text): a warning for any non-decorative visual; currently none.

**The 27 warnings** are measures nothing uses (neither a visual nor another measure). Five are the insight sentences left over
when the Overview takeaways were removed; the rest are helpers (for example lap-time and pit-stop aggregates) kept as building
blocks. They are listed so they can be deleted deliberately; I chose not to delete them in the same change as a redesign.

## Layer 2: independent recomputation
`f1evo` re-implements the definitions in `data-model.md` in pandas, reading the raw files directly. If Power BI and Python
disagree, one is wrong, and the disagreement is the finding. They agree:

| Anchor | Power BI | Python |
|---|---:|---:|
| Grands Prix held | 1,166 | 1,166 |
| Drivers who started | 790 | 790 |
| Constructors with a start | 199 | 199 |
| Circuits used | 78 | 78 |
| Victories | 1,169 | 1,169 |
| Drivers' titles (complete seasons) | 76 | 76 |
| Constructors' titles (complete seasons) | 68 | 68 |

The Python rules are unit-tested on a hand-worked synthetic dataset (`tests/conftest.py`) designed so that each rule has a
case that would fail if it were wrong: a car that failed to qualify, one that retired, a shared drive, a season in
progress.

## Layer 3: measures under filter states
States tested (DAX, live model): all seasons; 1950; 1957; 1958; 1988; 2021; 2025; 2026; the 1950s and 2020s; driver Hamilton;
constructor Ferrari; Mercedes; Hamilton and Ferrari; Hamilton, Ferrari and 1950 to 1957 (an impossible combination);
Italian circuits; Hamilton against Rosberg; Ferrari against McLaren in 2004; a season with no pit data (1988); one with
pit data (2019).

Selected results:
- Hamilton ranks 1 of 790 by wins; against Rosberg they share 188 races (123 to 65).
- Ferrari has 16 constructors' titles and Mercedes 8 (a 2000 to 2010 window shows 7 for Ferrari because the window is narrower).
- The impossible combination returns "No Grands Prix match this combination of filters. Remove a filter or press Reset filters."
- The partial-season banner is empty for 2025 and populated for 2026.
- Single season (2021): 22 Grands Prix, 21 drivers, 10 teams, 21 circuits, 22 victories.

Defects found by this layer: `Scoring Changes Detected` used `MAX` on a Boolean and errored (now counts seasons directly, 8
changes); six titles went blank from an `IF` that returned a table; a headline was blank for a single season and read
"100% to 100%" for a single driver; a Top-N chart let blank ranks through.

## Layer 4: rendered review
All eight pages and three tooltip pages render without error icons at the default state. Filtered states were rendered with
the generator's test mode (which must never be saved):

| Page | State | Result |
|---|---|---|
| Overview | Season 2021 | 22 Grands Prix, 21 drivers, 10 teams, 21 circuits, 22 victories, titles 1 + 1; no partial-season banner |
| Driver Intelligence | Hamilton compared with Rosberg | 397 starts, 106 wins, 7 titles; head-to-head 188 / 123 / 65 |
| Constructor Analysis | Ferrari against McLaren, 2000 to 2010 | 90 wins, 7 constructors' titles; season head-to-head populated |
| Race & Circuit Explorer | 2021 British Grand Prix, Silverstone | Classification (Hamilton 25 points), standings after the round (Verstappen 185), sprint table |
| Pit Stop Analysis | Season 1988 | "No pit-stop records..."; fallback chart "How starts ended" shows 73 / 133 / 165 / 37 / 5 / 7 |
| F1 Through the Eras | Hamilton and Ferrari 1950 to 1957 | Charts empty; the headline shows the empty-state message |

## Checklist before a release
| Item | Status |
|---|---|
| All eight navigation items open a working page | Pass |
| Reset filters clears every slicer | Built as the Clear all slicers action on every filtered page; present on all, click behaviour not scripted |
| Every slicer visibly changes the data where it should | Pass in the rendered tests above; the Era slicer verified by DAX |
| KPI totals reconcile with detail tables | Pass (head-to-head totals equal the DAX result; the champions table agrees with the title KPIs) |
| No inflated aggregates when filters change | Pass: all relationships single-direction, many-to-one |
| Labels match measure logic | Pass: Drivers and Constructors count starters; Titles count completed seasons |
| Missing values never become zero | Pass: blank grid is "Not recorded", grid 0 is "Pit lane / unrecorded"; blanks listed per column |
| Each season uses its own scoring system | Pass: recorded points as scored; era comparisons use rates and era-normalised points |
| Empty, invalid and partial-data states handled | Pass: empty message, partial banner, pit and lap coverage notes, race-view message |
| Readable at 1920 by 1080 | Pass for six pages; Race Explorer and Data Quality are taller pages shown fit to width |
| No placeholder visuals, no hard-coded statistics, alt text | Pass (lint) |
| Drill-through (season, driver, constructor) | Configured with Back buttons; loaded without error; not clicked in automated checks |

## Known limitations
- Sync slicers and drill-through were authored in the file format and loaded without errors; their cross-page behaviour was
  not exercised by script.
- Reset uses the Clear all slicers action rather than a bookmark, which would have to hard-code every slicer's state.
- No row-level security, refresh schedule, deployment pipeline, phone layout or screen-reader pass (`comparison/enterprise-matrix.md`).
- Python line coverage is about 91%; `cli.py` error branches are the main gap.

## Running everything
```powershell
uv sync
uv run ruff check . ; uv run ruff format --check . ; uv run mypy ; uv run pytest
uv run f1evo pbip check powerbi
$env:F1_RAW_DIR = "data/raw"; uv run pytest          # also runs the real-data test
uv run f1evo anchors --raw data/raw ; uv run f1evo data check --raw data/raw
```
CI (`.github/workflows/ci.yml`) runs the first group and the lint on every push; it cannot run the real-data checks because the
raw files are not in the repository.

## Keeping the expected numbers honest
`data/expected.json` is the contract between Power BI and Python. If the source CSVs are refreshed, update it in the same
commit as the report change, and say why in the message. A failing `f1evo anchors` after a refresh is either a real change in the
data or a regression in the model; it should never be silenced by editing the file without a reason.
