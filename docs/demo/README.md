# Demo

| File | What it is |
|---|---|
| [`f1-evolution-report-pages.pdf`](f1-evolution-report-pages.pdf) | **A PDF of the eight page screenshots, not a Power BI export.** One page per report page, built from `docs/images/after/0*.png` (the two taller pages keep their own height). Text in it is a picture, not selectable. |
| Demo video or GIF | **Not recorded yet.** No video link is published; see the steps below. |

The report itself needs Power BI Desktop and your own copy of the data (see [`../../data/README.md`](../../data/README.md)). The
Claude artifact is viewable only by people signed in to a Claude account (see [`../comparison/how-it-was-measured.md`](../comparison/how-it-was-measured.md)).

## Replace the PDF with a real Power BI export
1. Open `powerbi/F1 Dataset.pbip` in Power BI Desktop, set the **F1 CSV Folder** parameter and Refresh.
2. Make sure no slicer is filtered and no generator test-mode filter is on the report.
3. **File > Export > Export to PDF**, save as `docs/demo/f1-evolution-report-pages.pdf`. Tooltip pages are not exported.
4. Update the table above: it is then a Power BI export, and say that it was exported from Desktop on that date.

## Record a 60 to 90 second capture
1. Window at 1920 by 1080, report in reading view; close other windows.
2. Record with Win + G (Xbox Game Bar) or OBS. Keep it to one take, no audio needed.
3. Suggested path: Overview headline, choose a decade range on the Season slicer, open Driver Intelligence and pick two
   drivers, open Race & Circuit Explorer and choose a season and a Grand Prix (it is empty until you do), finish on Data Quality.
4. Trim to 90 seconds or less; export MP4 or GIF. Host it (for example as an unlisted video), do not commit a large binary.
5. Add the link to the README "See it" line and to this file.
