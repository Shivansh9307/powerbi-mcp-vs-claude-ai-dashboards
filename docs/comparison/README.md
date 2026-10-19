# Power BI report vs Claude artifact

Two builds of the same dashboard from the same data, both improved with *Storytelling with Data*. This folder holds the
comparison; start here.

**Access rule (observed 2026-10-19):** the Claude artifact can be viewed only by people signed in to a Claude account. Signed-out
visitors see an empty dashboard ("Nothing on this dashboard yet") and "Sign in to see this artifact's data". It cannot serve as a demo
for readers without an account, so the screenshots in `../images/artifact/` are the evidence for readers without an account. Those screenshots are a
local render of the same source, checked against the published artifact ([`how-it-was-measured.md`](how-it-was-measured.md)).

| Document | Answers |
|---|---|
| [page-by-page.md](page-by-page.md) | Which page tells its story better, and why. Screenshots side by side for all eight pages |
| [enterprise-matrix.md](enterprise-matrix.md) | What each does for governance, security, refresh, publishing, maintenance, cost. Every row labelled tested, documented or not exercised |
| [how-it-was-measured.md](how-it-was-measured.md) | What was held constant, how screenshots were taken, what was not tested, and my bias |

## The short answer
**They are not competitors; they answer different questions.** The artifact is the better *first read*: it opens on content,
states a Big Idea, and explains itself at every metric. The Power BI report is the better *thing to run a business on*:
its logic lives in a governed model that other reports, Excel and security roles can use, and it ships as reviewable files.
Neither is complete: the Power BI report has no row-level security, refresh schedule or deployment pipeline configured, and
the artifact is a fixed snapshot of uploaded CSVs with no security model.

## Storytelling scorecard (0 broken, 1 partly, 2 followed)
| Rule | Power BI | Why | Artifact | Why |
|---|:---:|---|:---:|---|
| Headline states the finding | **2** | All eight pages open on a measure-driven finding that follows the filters; one page (Race Explorer) shows an instruction until a race is chosen | **2** | Every page opens on a finding with numbers; chart titles are findings too |
| One accent colour | **2** | Amber only; white for emphasis; grey for context | **1** | Blue for the leader, orange for loss or mechanical, red for the selected item and active tab, gold for titles; each has a stated role, but it is four colours |
| Clutter removed | **1** | No panels, gridlines or markers, but dense reference tables (decade summary, classification) remain by choice | **1** | Bordered cards and gridlines on every chart; tables are dense |
| Direct labels and annotations | **1** | Data labels on bars; legends on multi-line charts; no peak annotations | **2** | Peaks and lows labelled on lines, series named at the line end, hatched partial seasons |
| Order and call to action | **2** | Eight headlines read in order tell the story; a "Next" button on each page | **2** | Big Idea then "So what"; a sidebar sequence; no "next" prompt |
| **Total** | **8 / 10** | | **8 / 10** | |

Equal scores hide different strengths: Power BI wins on discipline (colour, a sequence), the artifact on annotation and
on explaining itself. These are my judgements from the screenshots (see `how-it-was-measured.md`).

## Five findings worth a conversation
1. **The numbers agree because the definitions were agreed.** The first Power BI build did not match the artifact (865 vs
   790 drivers, 146 vs 144 titles) until "what is a start?" and "is a season in progress a champion?" were answered.
2. **The artifact's default state beats Power BI's.** A page that opens empty until you choose a race loses a first-time reader.
3. **A definition can differ without either side being wrong.** Pit-lane time "fell to 23.9 s in 2026" (artifact, includes a
   season in progress) against "23.1 s in 2025" (Power BI, last complete season); "7 scoring changes" against "8" (win points only
   against win or second-place points).
4. **The governance gap is structural, not a feature gap.** An artifact carries its data to every viewer; Power BI separates
   the model from the report and can secure rows in between. For public sports data that does not matter. For salaries it decides.
5. **Quality assurance can live outside the tool.** The artifact ships Node tests; this repo ships a Python recomputation
   and a model lint. Both beat "looks right".
