# Why Power BI Desktop stalled, and what fixed it

Notes from building the 8-page report (Power BI Desktop, a model that started at 15 tables and ended at 25, 885,381 lap rows) with an AI agent editing the model.

## Short answer
Mostly the wrong approach, not a hardware limit.
- **First stall:** genuine heavy work. Desktop was busy and eventually recovered.
- **Second stall:** a hung session. Nothing was computing, and CPU sat idle.

## What happened

| # | Issue | Evidence |
|---|---|---|
| 1 | Long "Working on it" after I rewrote the queries for Lap Times and Pit Stops (joined to the results file) and added about 40 columns, measures and relationships in one live session | Desktop used about 4.9 s of CPU per 5 s; 16 Power Query helper processes were running |
| 2 | Refresh failed: "A join operation cannot result in a table with duplicate column names" | The rollback left partitions unprocessed. Later edits failed with a blank error until a ClearValues refresh freed them. Later "base version must not be negative" errors needed a reconnect |
| 3 | An error dialog that could not be closed | After I renamed four measures, the open report pointed at fields that no longer existed ("Something went wrong rendering the report"). Escape, a mouse click and Tab/Enter did nothing; only closing Desktop helped |
| 4 | A second hang after I started a full refresh of a profiling query that reads all 14 CSV files and scans the 885k-row lap file column by column | Desktop showed "Could not find a PackageSession for the given sessionID". Both Desktop and its engine used 0.0 s of CPU over 5 s. The connection showed an open transaction. Every later model call waited until it timed out after 1,800 s |
| 5 | Unsaved work lived only in the stuck session | I had to export what I could and rebuild the rest in files |
| 6 | A later "indentation error" on opening the project | A dynamic format string must be the last property of a measure in the model file; I had put it in the middle |

## CPU limit or wrong approach?
- **Hardware was not the constraint.** The machine was a Ryzen 5 PRO at about 16% overall use, with Desktop using about 2 GB.
- **Stall 1** was real computation, but recoverable.
- **Stall 2** was not computation at all. Idle CPU, an open transaction and a "session not found" message point to the Desktop window and its built-in engine getting out of step after a modal error plus a long-running transaction. The exact internal cause is my inference, not something I proved.
- **The root cause was how I worked:**
  - using Desktop's built-in engine like a server for large batched edits;
  - changing data queries and renaming fields while the report was open on them;
  - queueing edits behind one heavy refresh.

## What fixed it
- Wrote the model changes straight into the TMDL project files with a small script, instead of through the live session.
- Validated the files offline with the same TMDL parser Desktop uses. It named the exact file and line of an error in seconds.
- Closed Desktop, reopened the project and clicked Refresh once.
- Worked in small steps: change, save, reload, screenshot.
- Generated the report pages from a script, and renamed model fields before touching the report that uses them.
- Kept heavy profiling queries separate from everyday refreshes.

## Takeaways
1. Treat Power BI Desktop as an app, not a server. Big automated edits can leave it hung.
2. Author the model as code (TMDL) and validate it offline before opening it.
3. Separate schema changes from data refreshes, and never batch them.
4. Never rename a field the open report uses without updating the report first.
5. Save in small checkpoints so a stuck session costs minutes, not an afternoon.

## How sure am I
- **Measured:** CPU readings, row counts (885,381 laps, 1,979 duplicates removed), the 1,800 s timeout and the error texts above.
- **Inferred:** why the second hang happened.

## A better prompt
The prompt I would use now, with these rules written into it, is in [`prompts/02-improved-build-prompt.md`](prompts/02-improved-build-prompt.md).

## Addendum: lessons from the storytelling redesign
- Desktop caches the result of a conditional-format colour measure by the measure's name. After changing what `DQ Table Status Color` returned, the visual kept drawing the old green although DAX returned the new grey. Creating the colour under a new measure name fixed it. Rename a measure when its formatting output must refresh.
- "Rank is at most N" filters on a measure let blank ranks through, so an unrelated item appears in the Top N. Add a "rank is at least 1" condition.
- A DAX `IF` cannot return a table variable. Return the table from `FILTER` with the fallback inside the condition instead.
- Never press Save while test-mode filters are on the open report: Desktop would write the test selections into the file. Regenerate the normal report and reload before the user saves.
- Each model rewrite needs the report reloaded with the model; "files were changed externally" in Desktop is expected after a rewrite and clears on save.
