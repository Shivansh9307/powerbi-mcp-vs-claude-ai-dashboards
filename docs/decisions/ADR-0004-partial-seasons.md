# ADR-0004: A season in progress counts in totals, awards no title, and is labelled everywhere

Status: accepted

## Context
2026 has 17 of 23 races run. Counting it as a champion gave 146 titles; ignoring it hid real races.

## Decision
A season is **complete** when races with results equal races scheduled and there is at least one; no year is hard-coded. Totals include a partial season; titles and 'first to last' comparisons use complete seasons only. A banner, a dotted line and a '(leader)' label show what is provisional.

## Consequences
- Result: 76 + 68 titles; headlines never quote a partial season.
- The artifact makes a different choice for pit-lane headlines (it ends at 2026), visible in `comparison/page-by-page.md`.
- When a season completes, the model rolls over without a change.
