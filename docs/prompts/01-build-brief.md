# Prompt 1: the brief for the 8-page build

The prompt I gave Claude Code, with the Power BI authoring MCP connected and Power BI Desktop open on the PBIP. It is kept
as I wrote it (including the artifact comparison it refers to) so the build is reproducible and so you can judge the
prompt. What it lacks, and what that cost, is in `../lessons-desktop-stalls.md`: it never told the agent how to work
with Power BI Desktop, only what to build.

---


> **Path note.** The brief was written in my working folder. `f1_pulse/` there is `artifact/` in this repo, `_brief/` is `docs/`, and the PBIP is in `powerbi/`.

## ROLE
You are a senior Power BI developer, semantic-model engineer, report designer and motorsport data analyst. You work in the existing local PBIP project in this folder: `F1 Dataset.SemanticModel` (TMDL) and `F1 Dataset.Report` (PBIR), through the Power BI modeling MCP and the `powerbi-report-cli` / `semantic-model-authoring` skills.

## GOAL
Finish the **8-page** report "F1 Evolution" (the same product name the artifact uses; use it as the report title and in the left-navigation brand block) so it can be compared fairly, page for page, with the Claude artifact dashboard that was built from the same Kaggle Formula 1 dataset. Do not respond with a plan only. Deliver the working report, validated and visually checked in Power BI Desktop.

Tagline (matches the artifact's brand block): "How the grid took over, 1950–2026"

## WHAT ALREADY EXISTS (read it first, do not rebuild blindly)
1. **Semantic model**: 15 tables (Season, Circuit, Constructor, Driver, Finishing Status, Race, Race Results, Sprint Results, Lap Times, Qualifying, Driver Standings, Pit Stops, Constructor Standings, Constructor Results, Date) and 30+ measures. Read `definition/tables/*.tmdl` and `relationships.tmdl` before changing anything.
2. **Report**: 2 pages today, "Overview" and "Season Overview" (`definition/pages/…`). The Overview page has the title, season-range slider, Driver / Constructor / Circuit-country dropdowns, 6 KPI cards, a 4-series dual-axis line chart, two top-10 wins bars, a champions timeline table, a latest-races table and a "What the data says" text panel.
3. **Specs**: `_brief/report-spec.md` (design contract for the first page) and the benchmark source in `f1_pulse/` (`README.md`, `DATA_DICTIONARY.md`, `src/pages1-3.js`, `data/*.csv`, `tests/reconcile.test.js`). The artifact is the reference for page content, metric definitions and numbers. **Use it to mirror scope and to cross-check results; never copy its numbers into the Power BI report as typed values.**

## PHASE 0: AUDIT AND FIX BEFORE BUILDING (mandatory, report what you found)
A comparison review of the two builds found real defects on the existing pages. Fix them in the model first, because the same measures will feed all 8 pages:

1. **"Drivers" and "Constructors" KPI cards are mislabelled.** `# Drivers Raced` and `# Constructors Raced` are DISTINCTCOUNTs over every Race Results row, which includes did-not-qualify, did-not-prequalify, 107%-rule and withdrawn entries. Today: 865 drivers and 213 constructors, of which about 72 drivers never started. Define **Start = a result row whose status group is not "Did not start"** and make the KPIs count starters only (artifact: 790 drivers and 199 constructors; expect a small difference if your status grouping differs, and document it).
2. **"Titles = 146" counts the in-progress 2026 season** (77 driver + 69 constructor titles; completed seasons give 76 + 68 = 144) and the champions table shows 2026 leaders as champions. Titles must come from final standings of **completed seasons only**. In-progress seasons show "Leader" with a visible "Season in progress: N of M races" flag. Add a `Season Is Complete` / `Races Scheduled` / `Races With Results` logic to the Season (or Race) table, not a hard-coded year.
3. **Grid Position blanks** in the latest-races table are unexplained. Treat grid 0 as "pit lane / unrecorded", missing as missing, and neither as a pole. Never show a blank where the data is 0, or 0 where it is missing.
4. Add the missing foundations (as calculated columns/tables or Power Query steps, whichever fits the existing model; no hard-coded stats):
   - **Status group** on Finishing Status: Finished / Lapped / Mechanical DNF / Accident DNF / Other DNF / Disqualified / Did not start. Priority rules are in `f1_pulse/DATA_DICTIONARY.md` (positionText F/W → Did not start; D/E → Disqualified; etc.). Use the same rules so results are comparable.
   - **Era / Decade** on Season.
   - **Era-normalised points** (recorded points ÷ points available that season), because scoring systems changed.
   - **Constructor identity**: do not silently merge renames (no lineage field in source). Document it on the Data Quality page.
5. Run every changed measure against these anchors and **record expected vs actual in a table in `_brief/qa-results.md`** (results can legitimately differ where definitions differ; explain each difference instead of forcing a match):

| Check | Artifact value |
|---|---|
| Grands Prix with results | 1,166 (2026: 17 of 23 races at build time) |
| Circuits | 78 |
| Victories | 1,169 (1,166 races + 3 shared-drive credits) |
| Completed-season titles | 76 driver + 68 constructor |
| Wins, drivers | Hamilton 106, Schumacher 91, Verstappen 73, Vettel 53, Prost 51 |
| Wins, constructors | Ferrari 251, McLaren 201, Mercedes 142, Red Bull 132, Williams 114 |
| Pole converted to win | 38% in the 1950s → 57% in the 2020s |
| Starts ending in retirement | 48% in the 1950s → 14% in the 2020s |
| Top driver's share of decade wins | 28% in the 1950s → 44% in the 2020s |
| Peak calendar | 24 races (2024), 7 in 1950 |

## DATA RULES (unchanged from the original brief, still binding)
- Inspect the data; never invent columns, tables or statistics. State every assumption.
- `\N` is null/missing, never zero.
- Respect grain: race result ≠ lap ≠ pit stop ≠ qualifying.
- Coverage: lap times ~1982+, pit stops ~1994+, qualifying ~1994+ (partial early), sprints 2021+, constructor standings 1958+. Verify these in the data and use the verified ranges.
- Official standings vs recalculated rankings; recorded zero vs missing; completed vs incomplete seasons; starts vs classified finishes; victories vs titles. Keep each distinction explicit in measures and labels.
- Use each season's own scoring system. Never apply modern scoring retroactively.
- Shared drives and ties handled correctly. Never assume 2026 is complete.

## DESIGN IDENTITY (one system across all 8 pages)
- Dark broadcast: canvas `#0F1115` (existing theme), panels `#181B21`, text `#F2F2F2`, muted `#9AA3AF`, one red accent `#E10600` for active nav, key metrics and selected entities; gold `#F5B301` for wins/titles; colour-blind-safe categorical palette; no colour-only encoding.
- 1920×1080 canvas, 12-column grid, 32 px margin, 24 px gutter, 8 px snap. Minimum text 10 pt. WCAG AA contrast. Alt text on every chart.
- **Insight titles, not topic titles.** The artifact's best idea is that headings state the finding ("A pole's chance of winning rose from 38% to 57%"). Build chart titles and the headline of each page from DAX measures so they react to the filters.
- One visual hierarchy per page: one hero visual, supporting visuals, then detail. Avoid equal-weight card walls, and avoid dual-axis charts with more than two series (replace the current 4-series dual-axis line chart on page 1 with small multiples or a metric-switch).
- Native visuals only. No R/Python/custom visuals unless certified and justified.

## NAVIGATION AND SHARED INTERACTIONS
- Left navigation using a page-navigator or buttons; the 8 pages in this order, active page in red:
  1. Overview  2. Driver Intelligence  3. Constructor Analysis  4. Race & Circuit Explorer  5. Qualifying & Race Performance  6. Pit Stop Analysis  7. F1 Through the Eras  8. Data Quality & Coverage
- **Global filters that persist across pages** (sync slicers): Era, From season, To season, Driver, Constructor, Circuit. Include a **Reset filters** button (bookmark that clears slicers), and a dynamic "Active filters" line on every page built from a measure (e.g. "Seasons 1950–2026 · No filters active").
- Metric switchers via **field parameters** (e.g. Wins / Podiums / Poles / Titles / Points / Starts on leaderboards).
- Drill-through: Season → Race Explorer, Driver → Driver Intelligence, Constructor → Constructor Analysis. Back buttons everywhere.
- Tooltip pages (report-page tooltips) that show metric definitions plus extra context for the main charts.
- Cross-filtering enabled by default; turn it off deliberately where it would mislead (e.g. winners table must not filter charts). Prevent contradictory states (e.g. driver and constructor combination with no rows shows an explicit empty-state message, not a blank chart).
- Partial-season banner (measure-driven, shown only when the selection includes an in-progress season).

## PAGE-BY-PAGE SPEC (mirror the artifact's scope, with Power BI-native visuals)

### 1. Overview (rework the existing page, keep what works)
Headline insight (measure-driven), partial-season banner, KPI strip with **corrected** Grands Prix / Drivers (starters) / Constructors (starters) / Circuits / Victories / Driver titles + Constructor titles (completed seasons) with definitions in tooltips; three decade small-multiples (retirement rate, pole→win conversion, top driver's share of wins); "Evolution by season" with metric switch (Grands Prix, Starts, Drivers, Constructors, Wins, DNF rate), partial seasons visually distinct; Driver and Constructor leaderboards with metric switch (Wins / Podiums / Poles / Titles / Points / Starts); Champions-by-season table (leader flagged for in-progress season); Most recent 25 Grands Prix; "Takeaways for this selection" generated by measures only.

### 2. Driver Intelligence
Searchable driver slicer and optional second driver for comparison; career KPIs (starts, wins, podiums, poles, win %, titles, points, DNF rate); season-by-season timeline; grid vs finish; constructor history; head-to-head table (races both started, who finished ahead); all-time leaderboard with metric switch; "Field in the same filters" context.

### 3. Constructor Analysis
Constructor selector; victories / titles (from 1958, "Not awarded" before) / points; season trend; reliability by season (mechanical and accident DNF rate); driver contributions (stacked bar of wins/points by driver); head-to-head by season; constructor leaderboard; rename caveat note.

### 4. Race & Circuit Explorer
Season, Grand Prix and circuit selectors (drill-through target from Overview champions table); full classification table (position, driver, constructor, grid, laps, status, points) with sticky header; grid-vs-finish scatter; positions gained bar; drivers' and constructors' standings after this round; sprint result when one exists; circuit directory (country, races held, first/last year, winners by driver and by constructor); winner's grid slot by year; retirement rate by year; races at this circuit table.

### 5. Qualifying & Race Performance
Win rate by starting slot; what happens from each slot (finish distribution); pole→win conversion by season; position-change distribution; laps led; qualifying records table (gap to session fastest, Q1/Q2/Q3, pole counts); race pace (field median lap by season) **only for seasons that have lap data**, with a coverage indicator.

### 6. Pit Stop Analysis
Scope indicator for seasons with pit-stop data. Typical pit-lane time by season (this is entry-to-exit pit-lane time, **not** stationary time; say so on the page); stops per car by season; distribution of pit-lane times; when in the race stops happen; pit-lane time by constructor; fastest recorded times with gap to race median. For seasons without data show the **fallback**: "How starts ended" (status groups). No causal claims from correlation.

### 7. F1 Through the Eras
Calendar growth; participation (drivers, constructors per season); scoring systems in the data and detected changes; decade summary table (wins concentration, DNF rate, pole conversion, classified-finish rate, era-normalised points); retirement causes per start; competitive balance (distinct winners per season, dominance index = win share × points share); "Seen in the dataset" vs "External historical context", labelled separately. A "Read this before comparing eras" note.

### 8. Data Quality & Coverage
Built from the real model (Power Query profiling queries or DAX tables, not typed values): loaded tables and row counts; where each table starts and ends; share of scheduled races with rows by table and season (heat-style matrix); missing values by table and column; duplicate-key checks (e.g. duplicate lap rows); unmatched foreign keys; official standings vs sum of race results by season; status-group lookup; constructor identity and renames; partial-season flag. Each check shows a Pass / Warn / Fail status computed by a measure.

## METHOD (follow in this order)
1. **Phase 0** above. Save findings and decisions to `_brief/audit.md`.
2. Write the extended spec for pages 3–8 into `_brief/report-spec.md` in the same canonical-contract format as page 1 (regions, placements, field bindings, interaction rules), then update the Overview contract.
3. Model work in a transaction per change set; test each new measure for several filter states (1950, 1957, 1958, 1988, 2021, 2025, 2026, a single driver, a single constructor, an empty combination). Export to TMDL.
4. Author the report page by page with the report CLI; `validate` after each batch; open the PBIP in Desktop and screenshot each page at 3 filter states (default, one season, one driver). Fix overflow, clipping, illegible text and empty states before moving on.
5. Final QA pass against the checklist below. Write results to `_brief/qa-results.md`.

## FINAL QA CHECKLIST (must pass before delivery)
1. All 8 navigation items open a working page; Reset filters works from every page.
2. Every slicer visibly changes the data on every page it should affect.
3. KPI totals reconcile with the detail tables on the same page.
4. No duplicated or inflated aggregates when selections change (test with relationship filter direction and many-to-many risk).
5. Labels match the measure logic (no more "started a race" counting non-starters).
6. Titles come from completed seasons only; 2026 is flagged everywhere it appears.
7. Missing values never become zero or invented results.
8. Each season uses its own scoring system; era comparisons use rates or era-normalised points.
9. Tables are searchable/sortable where useful; headers readable.
10. Empty, invalid and partial-data states are handled with messages.
11. Readable at 1920×1080 and in Desktop's default fit-to-page on a laptop.
12. No placeholder visuals, no hard-coded statistics, alt text on all charts.

## DELIVERABLES
- The complete 8-page PBIP report, saved locally (no publish).
- New/changed measures documented with display folders and descriptions (the measure description is the metric definition).
- `_brief/report-spec.md`, `_brief/audit.md`, `_brief/qa-results.md`.
- A concise data dictionary for the Power BI model (tables, grain, key measures with DAX, status-group rules, treatments and limits).
- After the work: a 3–5 line summary, the 8–10 headline insights computed from the model, a list of assumptions/limitations, and a short **"Power BI vs artifact" note** listing what could not be matched natively and why.

Prioritise metric correctness, interactivity and a clean visual hierarchy over adding extra charts. Every number must be derived from the model.
