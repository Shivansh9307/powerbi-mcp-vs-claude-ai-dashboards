# F1 Evolution

Dashboard source, data prep and tests.

| Path | What |
|---|---|
| `prep_data.py` | Raw Kaggle-style CSVs → 17 analysis-ready tables in `data/` |
| `src/` | Page code (`core.js` model + metrics, `ui.js` kit, `pages1-3.js`, `main.js` shell, `app.css`) |
| `tests/reconcile.test.js` | Reconciliation tests (`node tests/reconcile.test.js`, no install needed) |
| `DATA_DICTIONARY.md` | Every metric and table, traceable to the source columns |
| `preview/` | Local stand-in for the dashboard runtime (needs internet for d3 from a CDN) |

## Refreshing with new races
1. Replace the raw CSVs, then `python prep_data.py <raw_dir> data`.
2. Run `node tests/reconcile.test.js` — it must pass before publishing.
3. Re-upload the changed `data/*.csv` files to the dashboard and update each dataset's `updated` stamp (ask Claude to do this).

The dashboard is a fixed snapshot; it does not pull new data on its own.
