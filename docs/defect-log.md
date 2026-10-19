# Defect log

One list of everything that was wrong with the AI-built report and how it was found, de-duplicated across the documents that
describe it. A bug that two documents mention is one row here. Only what those documents state is logged; nothing is
reconstructed from memory.

Sources: [`data-quality.md`](data-quality.md) (audit), [`ai-workflow.md`](ai-workflow.md) ("What the default AI output got wrong"),
[`storytelling-pass.md`](storytelling-pass.md) ("Defects the pass found"), [`testing-and-qa.md`](testing-and-qa.md) (layer 3),
[`lessons-desktop-stalls.md`](lessons-desktop-stalls.md) (process failures, not report defects, so not logged here).

**Total: 19 defects.** Audit 7, page build 3, QA 1, storytelling pass 8 (six bugs and two design findings).

| # | Stage found | What looked fine | What was wrong | How it was found | Fix | Evidence |
|--:|---|---|---|---|---|---|
| 1 | audit | KPIs "Drivers 865" and "Constructors 213" | Both counted every result row, including cars that never started; 1,714 of 27,612 rows carry position code `F` or `W`. Starters are 790 drivers and 199 constructors | Comparing with an independent build of the same data (the Claude artifact) | `Status Group` and `Started` columns; `# Drivers Started` and `# Constructors Started` count starters | `data-quality.md` finding 1; `uv run f1evo anchors --raw <csv folder>` (790, 199) |
| 2 | audit | KPI "Titles 146 (77 + 69)" | Counted the 2026 leaders as champions with 17 of 23 races run; completed seasons give 144 (76 + 68) | Same comparison with the artifact | `Season[Is Complete]` (races with results equal races scheduled, no hard-coded year); a season in progress shows "(leader)" | `data-quality.md` finding 2; `docs/decisions/ADR-0004-partial-seasons.md`; `f1evo anchors` (76, 68) |
| 3 | audit | `Finish Position` filled for every row | 126 rows in 2025 to 2026 (R 110, W 10, D 6) have a numeric position but a non-numeric position text, so classified finishes were overstated | Raw-file audit | Finish position follows the position text | `data-quality.md` finding 3; `uv run f1evo data check --raw <csv folder>` |
| 4 | audit | A pole was any `Grid = 1` row; grid 0 unexplained | 1,638 rows have grid 0; non-starters could count as poles | Raw-file audit | Poles count starters only; grid 0 shows "Pit lane / unrecorded", a missing grid "Not recorded" | `data-quality.md` finding 4; `docs/data-model.md` |
| 5 | audit | Lap data loaded without error | 1,979 repeated (race, driver, lap) rows | Raw-file audit | Removed in Power Query: 883,402 of 885,381 rows kept | `data-quality.md` finding 5; `data/README.md` table; `f1evo data check` |
| 6 | audit | Pit Stops and Lap Times in the model | No constructor link, so the constructor slicer could not filter them | Raw-file audit | `Constructor Id` merged from the race result; relationships added | `data-quality.md` finding 6; `docs/data-model.md` |
| 7 | audit | Qualifying times present | Q1 to Q3 held only as "m:ss.000" text | Raw-file audit | Millisecond columns and a best-time column added | `data-quality.md` finding 7 |
| 8 | page build | A pit-time gap measure | The gap could go negative and mislead | Building pages 2 to 8 | Not stated in the docs beyond "fixed" | `data-quality.md` (prose after the Phase 0 table); see Gap below |
| 9 | page build | A coverage heat map | It hid missing tables | Building pages 2 to 8 | The Data Quality page now shows coverage by season and table as a single-hue heat map | `data-quality.md` (prose) and "How the Data Quality page works" |
| 10 | page build | Head-to-head wins | Showed blank instead of zero | Building pages 2 to 8 | Not stated in the docs beyond "fixed" | `data-quality.md` (prose); see Gap below |
| 11 | QA | `Scoring Changes Detected` | Used `MAX` on a Boolean and errored | Measure tests at 19 filter states (QA layer 3) | Counts seasons directly (8 changes) | `testing-and-qa.md` layer 3 |
| 12 | storytelling pass | "Last complete season" logic; six chart titles | Returned a table from `IF`, which DAX does not allow; six titles went blank | Testing every title under every filter state | One season list is kept and the fallback moved into the `FILTER` condition (`dax-patterns.md` pattern 2) | `storytelling-pass.md` defect 1; `ai-workflow.md`; `testing-and-qa.md`; `dax-patterns.md` pattern 2 |
| 13 | storytelling pass | Overview headline | Blank for a single season (no two decades to compare) | Filter-state testing | Not stated beyond "covered by the filter-state checks"; the headline now has an empty-state and fallback (`dax-patterns.md` pattern 8) | `storytelling-pass.md` defect 2; `testing-and-qa.md` layer 3; `dax-patterns.md` pattern 8 |
| 14 | storytelling pass | Overview headline | With one driver selected it read "the top driver's share of wins rose from 100% to 100%" | Filter-state testing | The single-driver case takes the plain sentence (`dax-patterns.md` pattern 8) | `storytelling-pass.md` defect 3; `testing-and-qa.md` layer 3; `dax-patterns.md` pattern 8 |
| 15 | storytelling pass | Top-N chart of pit time by constructor | Included teams with too few stops: a blank rank passes "at most N" (also present in version 1) | Reading the chart against the DAX result | Second condition on the same visual: rank is at least 1 (`dax-patterns.md` pattern 4) | `storytelling-pass.md` defect 4; `ai-workflow.md`; `testing-and-qa.md` layer 3; `dax-patterns.md` pattern 4 |
| 16 | storytelling pass | A status colour | Kept its old shade after the measure changed: Desktop caches colour by measure name | Sampling pixels in the screenshot against the measure's output | Rename the measure when its output must change | `storytelling-pass.md` defect 5; `ai-workflow.md` |
| 17 | storytelling pass | Tooltip cards | Cards overlapped their labels | Rendered review of the tooltip pages | Fixed in the restyle; the docs do not record the specific change | `storytelling-pass.md` defect 6; `docs/images/after/tooltip-*.png` |
| 18 | storytelling pass | Every page headline | The same sentence on every page (a design finding, not a calculation error) | Reading the headlines in order against the book's rules | A page-specific action headline per page, built by a measure | `storytelling-pass.md` (headlines table); `ai-workflow.md` |
| 19 | storytelling pass | Colour | Five colours with no rule (a design finding) | Counting accent use against the book's guideline | Amber `#F5B301` is the only accent; greys for context | `storytelling-pass.md`; `docs/decisions/ADR-0007-one-accent-colour.md` |

## Gap in the record
`data-quality.md` says "findings 8 to 14" (seven items) came during the build of pages 2 to 8. The documents name only four of
them (rows 8 to 11 above; the fourth, the Boolean `MAX`, is described in `testing-and-qa.md` rather than in the build prose).
The other three cannot be reconstructed from the documents and are **not** logged. Rows 8 and 10 also lack a recorded fix.
`ai-workflow.md` does not contain findings 8 to 14, despite an earlier cross-reference saying so.

## Not logged on purpose
- The design critiques of version 1 in [`storytelling-pass.md`](storytelling-pass.md) (boxed panels, gridlines, two dual-axis
  charts, tilted labels, zebra tables) are style choices measured against a book, not defects; only the two design findings
  that [`ai-workflow.md`](ai-workflow.md) lists as "what the default AI output got wrong" are in the table (rows 18 and 19).
- Process failures (Desktop hung twice) are in [`lessons-desktop-stalls.md`](lessons-desktop-stalls.md).
