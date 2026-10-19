# Tools

| Folder | What | Run |
|---|---|---|
| `report-generator/gen/` | Generates the 8 pages, 3 tooltip pages and the theme as PBIR JSON. `f1-lib.js` = builders and design tokens, `pages-a.js`, `pages-b.js` = pages, `gen-f1.js` = entry point | `node tools/report-generator/gen/gen-f1.js "powerbi/F1 Dataset.Report" f1evo002` |
| `report-generator/model/` | Adds or replaces measures in the TMDL files. `defs-*.js` hold the definitions, `apply*.js` write them, `remove-old.js` deletes superseded measures | `node tools/report-generator/model/apply-story.js "powerbi/F1 Dataset.SemanticModel/definition"` |
| `audit/` | The Phase 0 raw-file audit (starters versus entries, shared drives) | `node tools/audit/audit-raw.js data/raw` |
| `artifact-capture/` | Renders the Claude artifact's pages with Playwright for the comparison | See `docs/comparison/how-it-was-measured.md` |

Rules for the generator (learned the hard way; see `docs/lessons-desktop-stalls.md`):
- Close Power BI Desktop or leave it saved and idle before regenerating; reload afterwards (`powerbi-report-author preview ... --reload`).
- Visual ids are random on each run, so a text diff of regenerated files is noise; use `f1evo pbip check` and screenshots.
- `F1_TEST=1` or `F1_TEST=empty` writes filtered test states. Never save the report in that state.
- Desktop strips `$schema` from `.pbip` and `definition.pbir` on save; restore them before committing (the lint reports it).
- The model scripts assume the measures they replace exist with the same names; renaming a measure a visual uses breaks the report (the lint reports it).
