# F1 Evolution: two AI dashboards, Power BI (MCP) vs Claude Artifacts, one human review

**Same data, same scope, two AI-built dashboards. What separates a demo from a trustworthy report is one human review: definitions, tests and storytelling. "Trustworthy" here means numbers verified and definitions documented, not production-deployed. This repository is the evidence.**

![Before and after: the same Overview, before and after applying Storytelling with Data](docs/images/before_after_overview.png)

I built the same 8-page Formula 1 dashboard (1950 to 2026) twice with AI: once as a Power BI report, using Claude Code, the Power BI
authoring MCP and Power BI Desktop, and once as a Claude Artifact. Then I reviewed it as a BI developer would: I audited the numbers,
rebuilt the Power BI design with the rules from *Storytelling with Data*, verified the figures independently in Python, and compared
the two dashboards page by page and against enterprise requirements (governance, security, refresh, publishing, maintenance).

| | |
|---|---|
| **The model** | 25 tables, 28 relationships, **200 documented DAX measures**, Import mode, stored as TMDL text |
| **The report** | 8 pages, 3 tooltip pages, **268 visuals**, generated from code, drill-through, synced slicers |
| **The numbers** | 7 headline figures reproduced in Python from the raw CSVs: 1,166 races, 790 drivers, 199 constructors, 78 circuits, 1,169 wins, 76 + 68 titles |
| **The checks** | 59 pytest tests, strict mypy, ruff, and a Power BI project lint with **0 errors** |
| **The defects** | 19 logged defects: 7 from the audit, 3 from the page build, 1 from QA, 8 from the storytelling pass ([`docs/defect-log.md`](docs/defect-log.md)) |

## Read this in three minutes
1. **The first build was wrong in ways a stakeholder would catch.** It showed 865 drivers (790 started a race) and 146 titles (it counted the season in progress as champions). The DAX was right; the definitions were not. [`docs/data-quality.md`](docs/data-quality.md)
2. **It was also hard to read.** Same headline on every page, five colours with no rule, boxed panels, two dual-axis charts. I gave the AI the book and made it measure the report against the rules first. [`docs/storytelling-pass.md`](docs/storytelling-pass.md)
3. **A second implementation keeps it honest.** `uv run f1evo anchors` re-computes the headline numbers from the raw files with pandas. It agrees with Power BI. [`docs/testing-and-qa.md`](docs/testing-and-qa.md)
4. **The Claude artifact is better in places, and I say where.** Always-populated default states, a Big Idea with a "So what", sparklines, definitions at every metric. Power BI wins on governance, security, refresh and reuse. [`docs/comparison/`](docs/comparison/README.md)
5. **Working with an AI on Power BI Desktop has failure modes.** It hung twice. The cause was my method, not the machine, and the fixes are written as rules. [`docs/lessons-desktop-stalls.md`](docs/lessons-desktop-stalls.md)

## The story the eight headlines tell
Each page opens with a finding written by a DAX measure, so it follows the filters. Read in order, they are the argument.

| # | Page | Headline at default filters |
|---|---|---|
| 1 | Overview | 1950s to 2020s: retirements fell from 48% to 14%, poles converted to wins 38% to 57%, the top driver's win share 28% to 44%. |
| 2 | Driver Intelligence | Lewis Hamilton leads with 106 wins in the seasons in view. Choose a driver to see their story. |
| 3 | Constructor Analysis | Ferrari leads the constructors with 251 wins in the seasons in view. Choose a constructor to see their story. |
| 4 | Race & Circuit Explorer | Choose a season and a Grand Prix to see how one race unfolded. |
| 5 | Qualifying & Race Performance | From pole, 43% of starts ended in a win, and the average qualifying lap was 2.4% slower than the fastest of its session. |
| 6 | Pit Stop Analysis | Typical pit-lane time fell from 30.4 s in 1994 to 23.1 s in 2025, entry to exit. |
| 7 | F1 Through the Eras | From 1950 to 2025 the calendar went from 7 to 24 races, retirements fell from 49% to 11% of starts, and the scoring system changed 8 times. |
| 8 | Data Quality & Coverage | 13 of 15 tables pass the integrity checks; 1 warns and 1 fails. Each is explained below. |

<details>
<summary><b>See all eight pages (final version)</b></summary>

| | |
|---|---|
| ![Overview](docs/images/after/01-overview.png) | ![Driver Intelligence](docs/images/after/02-driver-intelligence.png) |
| ![Constructor Analysis](docs/images/after/03-constructor-analysis.png) | ![Race and Circuit Explorer](docs/images/after/04-race-circuit-explorer.png) |
| ![Qualifying and Race Performance](docs/images/after/05-qualifying-race-performance.png) | ![Pit Stop Analysis](docs/images/after/06-pit-stop-analysis.png) |
| ![F1 Through the Eras](docs/images/after/07-f1-through-the-eras.png) | ![Data Quality and Coverage](docs/images/after/08-data-quality-coverage.png) |

Tooltip pages: [driver](docs/images/after/tooltip-driver.png), [constructor](docs/images/after/tooltip-constructor.png), [season](docs/images/after/tooltip-season.png).
Every "before" screenshot is next to its "after" in [`docs/storytelling-pass.md`](docs/storytelling-pass.md).
</details>

## How it is built
```mermaid
flowchart LR
    CSV[14 raw CSV files] --> PQ[Power Query] --> MODEL[Semantic model<br/>TMDL, 200 measures] --> REPORT[Report<br/>PBIR, 268 visuals]
    GEN[Node generator] -- writes --> REPORT
    PY[f1evo - Python] -- recomputes and lints --> MODEL
    PY -- reads --> CSV
    AGENT[Claude Code + modeling MCP + report-author CLI] -- edits files, validates, screenshots --> MODEL
    REPORT --> DESKTOP[Power BI Desktop - viewer]
```
The model and the report are **text files** (PBIP). That is what lets an AI edit them, a linter check them and Git track
them. [`docs/architecture.md`](docs/architecture.md), [`docs/data-model.md`](docs/data-model.md)

### The model is a star schema, with definitions that decide the numbers
Single-direction one-to-many relationships; Race Results at the centre; seven definitions (start, win, pole, shared drive,
complete season, title, pit-lane time) written down and tested. [`docs/data-model.md`](docs/data-model.md)

### DAX that earns its place
Two of eight patterns documented in [`docs/dax-patterns.md`](docs/dax-patterns.md):

```dax
-- Compare the first and last decade in view without losing the filter context
VAR _ra = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Decade] = _a))
VAR _rb = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Decade] = _b))
```
```dax
-- Colour follows the data: amber on the ends of the range in view, grey elsewhere
Color Decade Ends =
    VAR _cur = MAX('Season'[Decade])
    VAR _dec = FILTER(ALLSELECTED('Season'[Decade], 'Season'[Era]), CALCULATE([Starts]) >= 100)
    RETURN IF(_cur = MINX(_dec, 'Season'[Decade]) || _cur = MAXX(_dec, 'Season'[Decade]), "#F5B301", "#5B6470")
```
Also covered: last complete season without returning a table from `IF`, titles from final standings of complete seasons,
ranks that behave in Top N, field-parameter metric switches with dynamic formats, and text that explains itself.

## Building with Claude Code and the Power BI authoring MCP
I treated the AI as a fast junior engineer and kept the definitions, the taste and the numbers.
- **Delegated:** reading the data and writing the audit; 200 measures with descriptions; generating pages from code; running every
  measure under 19 filter states; extracting the book's rules.
- **Kept:** what a "driver" and a "title" are; the page scope; the colour rule; what to leave off the page; what not to ship.
- **Guardrails** after Desktop hung twice: Desktop is a viewer, the model is authored as files and validated offline, change sets
  of at most ten objects, schema changes never share a step with a refresh, never rename a field a report uses.

[`docs/ai-workflow.md`](docs/ai-workflow.md) · [`docs/prompts/`](docs/prompts/01-build-brief.md) (the brief I gave, and the prompt I would give now)

## Improving the AI's default with *Storytelling with Data*
| Rule from the book | Before | After |
|---|---|---|
| Action titles, one Big Idea | The same headline on every page | A finding per page, built live from the data |
| Grey for context, one accent | Five colours | Amber on the story point only |
| Remove clutter | Boxes, gridlines, markers | White space |
| Avoid secondary axes | Two dual-axis charts | Two aligned charts each |
| Avoid diagonal text, red/green | Tilted labels, green Pass | Horizontal labels, neutral status |
| Order and a call to action | Five takeaway lines | A "Next" button on each page |

The redesign found six more bugs and two design findings, because it forced every headline to be tested under every filter state ([`docs/defect-log.md`](docs/defect-log.md)).
[`docs/storytelling-pass.md`](docs/storytelling-pass.md)

## Power BI vs the Claude artifact
| Question | Power BI report | Claude artifact |
|---|---|---|
| Which tells its story better on first read? | Close | **Slightly ahead**: opens on content, Big Idea plus "So what", annotations (equal scores, different strengths: see [`docs/comparison/`](docs/comparison/README.md)) |
| Storytelling rubric (my scoring, 0 to 10) | 8 | 8 (equal scores, different strengths: see [`docs/comparison/`](docs/comparison/README.md)) |
| Where does the logic live? | A governed model of 200 measures | 2,289 lines of JavaScript (`artifact/src/*.js`) over uploaded CSVs |
| Row-level security | Available; **not configured here** | No concept: the viewer receives the data |
| Refresh | Model refresh; schedule needs a gateway or cloud source (not exercised) | Fixed snapshot; re-upload to update |
| Version control and CI | PBIP files, lint in CI | Source files and 13 Node tests (defined in `artifact/tests/reconcile.test.js`; not run here) |
| Cost of sharing | Licences for viewers on shared content (check current pricing) | A link to people with access |

The artifact came first and set the scope and definitions, so matching numbers between the two builds are not independent confirmation; the independent check is `f1evo anchors`, which reads the raw files.

Page-by-page screenshots, 40 enterprise rows labelled *tested*, *documented* or *not exercised*, and what I could not test are in
[`docs/comparison/`](docs/comparison/README.md).

## Quick start
You need [uv](https://docs.astral.sh/uv/), Power BI Desktop (Windows) for the report, and your own copy of the 14 CSV files
(they are not in this repository; see [`data/README.md`](data/README.md)).

```powershell
git clone https://github.com/Shivansh9307/powerbi-mcp-vs-claude-ai-dashboards.git
cd powerbi-mcp-vs-claude-ai-dashboards
uv sync
uv run f1evo pbip check powerbi                      # lint the Power BI project, no data needed
uv run f1evo anchors --raw data/raw                  # recompute the 7 headline numbers from your CSVs
uv run f1evo data check --raw data/raw               # profile the files against the Data Quality page
uv run pytest                                        # 59 tests (set F1_RAW_DIR to include the real-data test)
```
To open the report: put the CSVs in `data/raw`, open `powerbi/F1 Dataset.pbip`, set the **F1 CSV Folder** parameter to that path,
then Refresh. Do not edit the model while it refreshes.

## Repository map
| Path | Contents |
|---|---|
| `powerbi/` | The PBIP: semantic model (TMDL) and report (PBIR) |
| `src/f1evo/`, `tests/` | Python verification tooling and its tests |
| `tools/` | The report generator, the model scripts, the raw-file audit, the artifact capture script |
| `artifact/` | Source of the Claude artifact, kept as the comparison baseline |
| `docs/` | Architecture, data model, DAX patterns, data quality, AI workflow, storytelling pass, testing, comparison, decisions, prompts, and all screenshots |
| `data/` | `expected.json` and how to obtain the CSVs |

## Limits, and what I would build next
**Not done, on purpose or for lack of time:** row-level security; a scheduled refresh and gateway; incremental refresh on the lap
table; deployment pipelines or Fabric Git integration; a phone layout; a screen-reader pass; a paginated report; cross-page
behaviour of sync slicers and drill-through is loaded without errors but not scripted.

**Known debt:** 27 measures are unused (five insight sentences are left over from the redesign; the lint lists them). Constructor
renames are not merged because the source has no lineage field. Pit-lane time is entry to exit, not the stationary stop.

**Next, in order:** default the Race Explorer to the latest race; direct labels on trend peaks; one sentence of field context in
KPI cards; a row-level-security demonstration by team; incremental refresh on laps; delete the unused measures.

## Licence and attribution
Code and documentation: MIT ([`LICENSE`](LICENSE)). The data is not included and has its own terms; the book is cited and
paraphrased, never reproduced; this is an independent project with no connection to Formula 1 ([`NOTICE.md`](NOTICE.md)).
