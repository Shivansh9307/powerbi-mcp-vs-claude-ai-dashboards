# How the comparison was made, and what it cannot tell you

## What was held constant
- **Data:** the same 14 Ergast-layout CSV files. The artifact reads 17 tables derived from them by `artifact/prep_data.py`; I
  regenerated those tables from the raw files and they were byte-identical to the ones the artifact was built from.
- **Numbers:** both builds must reproduce the same anchors. They do: 1,166 Grands Prix, 790 drivers, 199 constructors, 78
  circuits, 1,169 victories, 76 + 68 titles. The Power BI side is also reproduced independently by `f1evo anchors`.
- **Scope:** the same eight pages and product name. Where one build has a view the other lacks, the page-by-page document says so.
- **Design brief:** both were revised against *Storytelling with Data* after a first version existed.

## How the screenshots were taken
| | Power BI | Claude artifact |
|---|---|---|
| Tool | `powerbi-report-author preview --screenshot --all-pages` against an open Power BI Desktop window | Playwright driving a locally installed Chrome (`tools/artifact-capture/capture.py`) |
| State | Default filters (all seasons); plus filtered states used in QA | Default filters, plus Hamilton vs Rosberg, Ferrari vs McLaren, season 2021, Silverstone |
| Size | Report page 1920 by 1080 (two pages are taller, shown fit-to-width); cropped from a 3510 by 1500 window capture | 1600 px wide viewport at 1.5x scale, full-page, cropped at 3,600 CSS px (the Data Quality page runs to about 12,000) |

**Why the artifact was rendered locally.** The artifact is plain browser JavaScript. `artifact/preview/index.html` is a
small stand-in for the runtime claude.ai provides, so the same source runs in a script and can be captured at a fixed size.
I also opened the **published** artifact in a signed-in browser and checked it against the local render: same navigation,
same Overview headline and numbers, and the source files were last modified at about the time the artifact was last updated. I did not
screenshot every published page, so a difference that only exists on the platform would not show here.

## How the storytelling rubric was scored
Five rules, each scored 0 (broken), 1 (partly followed) or 2 (followed), from the screenshots:

1. **Headline states the finding**, not the topic.
2. **One accent colour** carries the story; the rest is quiet.
3. **Clutter removed:** no boxes, gridlines or markers that carry no information.
4. **Direct labels and annotations** on the point that matters, instead of a legend and a hunt.
5. **Order and call to action:** the pages read as a sequence that ends somewhere.

These are my judgements. A different reviewer could move a score by one point; the reasons are written down so you can
disagree with the reason rather than the number.

## What was tested, and what was not
**Tested here:** the PBIP builds and validates (0 errors), every measure has a description and display folder, every
visual points at an existing field, 19 filter states return sensible measures, the Power BI numbers are reproduced in
Python, the artifact's 13 tests pass, the artifact renders on 11 states, the published artifact opens and matches.

**Not tested:** row-level security on either side; publishing the Power BI report to a workspace; scheduled refresh or a
gateway; deployment pipelines; load or concurrency; screen-reader use; phone layouts; the artifact's behaviour for a user
without access. Rows in `enterprise-matrix.md` that depend on these carry the label **D** (documented) or **N**.

## Bias to account for
- I built the Power BI report and know its failure modes better than the artifact's. I tried to read the artifact the way a
  new reviewer would, and credited it where it is stronger (Big Idea and "So what", default states, sparklines, definitions
  at the point of use, annotations).
- Both builds were produced with the same AI. Differences reflect the toolchain and the amount of iteration as much as the
  platforms.
- The artifact was built first and the Power BI brief used it as the benchmark, so the Power BI report inherited its scope
  and metric definitions. That is a reason the numbers match; it is not independent confirmation of them. The independent
  confirmation is `f1evo anchors`, which reads the raw files.

## Reproduce the artifact captures
```powershell
uv run python artifact/prep_data.py data/raw artifact/data
uv run --no-project --with playwright python tools/artifact-capture/capture.py
```
Needs Google Chrome installed (no browser download) and internet access (the preview loads d3 from a CDN).
