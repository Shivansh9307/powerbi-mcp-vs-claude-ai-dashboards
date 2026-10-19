# Roadmap: next changes, with the approach written down

These are proposals, not done work. Nothing below was run in Power BI Desktop; where a number comes from the generator source it
says so. The unused-measure clean-up listed earlier as "next" is done (0 lint warnings, 169 measures).

## 1. Race & Circuit Explorer opens empty

**Today:** the page shows "Choose a season and a Grand Prix to see how one race unfolded" and empty tables until a race is
chosen. The artifact opens on a race, which is why the comparison scores this page in its favour.

**Why it was not changed in this pass.** The only way the generator can save a slicer selection is a literal filter in the slicer's
`objects.general.properties.filter` (the `filter` option of `slicer()` in `tools/report-generator/gen/f1-lib.js`, currently
filled only by generator test mode, `F1_TEST`). A literal means:
- the saved race is a fixed value that goes stale at the next data refresh, which contradicts the project rule that nothing is
  typed in (no hard-coded year, no hard-coded race);
- the right value (latest race with results, and how the `Race` column spells it for that season) lives in the data, and the
  raw CSVs and Desktop were not available, so it would be a guess;
- whether Desktop honours a saved single-select state, and how it interacts with the Season range sync slicers and drill-through,
  can only be confirmed by opening the report. Guessing here risks the failure that test-mode filters caused earlier (a saved
  filter that cannot be cleared).

**Proposed approach (needs Desktop open once to verify):**
1. In `gen-f1.js`, add a separate switch `F1_DEFAULT_RACE=<season>|<race name>` (not `F1_TEST`, so it can never be confused with a
   test state) that passes a `filter:` to the two explorer slicers (`season_single`, `grand_prix` in `pages-b.js`).
2. Fill it from the data at generation time (the latest race with a start, computed by `f1evo`'s existing definitions), and
   document that the report must be regenerated after a refresh.
3. Regenerate only the Explorer page, run `uv run f1evo pbip check powerbi`, open in Desktop, confirm the headline reads
   "<Race> <year>: <winner> ..." and that "Reset filters" returns to the default race rather than empty.
4. Alternative without a literal: make the race-view measures fall back to the latest race when no single race is selected (a
   measure change touching the race-view set, to be done in change sets of at most ten, with the `Headline Explorer` text
   updated so the page does not claim a choice that was not made).

## 2. Overview tables clip their last row at the default size

**Observed** in `docs/images/after/01-overview.png`: the "Champions by season" and "Most recent 25 Grands Prix" tables show about
three full rows and a clipped fourth.

**Cause (from `tools/report-generator/gen/pages-a.js`, `overview()`):** the page body starts at `BODY_Y = 200`; the three hero charts
use `hh = 240`, the support charts `sh = 284`, with 16 px gaps, so the tables start at y = 868 and get `dh = 1066 - 868 = 198` px
(a fixed 1080 px page, 14 px bottom margin). That height holds the visual title, a header row and fewer than five body rows at
font size 10 with 4 px row padding.

**Proposed change:** reduce the support-chart band `sh` from 284 to 250, which gives the tables 232 px (+34 px, about one more
row), then regenerate the Overview page and screenshot it. If the charts need their height, the alternative is to cut the tables
to the top five rows (replace `measureFilter(RR, 'Latest Race Rank', 4, 25)` with a 5-row rank filter and retitle "Most recent 5
Grands Prix") so nothing is cut mid-row. Either way the tables' on-screen scroll bar stays available. Screenshots were not
retaken in this pass because Desktop was closed.
