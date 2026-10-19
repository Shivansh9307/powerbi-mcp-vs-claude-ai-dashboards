# v1.0.0: F1 Evolution, Power BI (MCP) vs Claude artifact, one human review

First tagged version. The repository was **published as a single commit** (`fe02cf3`, 2026-10-19), so there is no earlier
history to summarise; the changes after it are in the credibility pass that followed.

## What is in it
- A Power BI project (PBIP: TMDL model plus PBIR report) on Formula 1 results, 1950 to 2026: 25 tables, 28 relationships,
  169 documented measures (0 lint warnings), 8 pages, 3 tooltip pages, 268 visuals.
- `f1evo`, a Python package that re-computes seven headline numbers from the raw CSVs and lints the Power BI project, with
  pytest, strict mypy, ruff and CI (`.github/workflows/ci.yml`).
- The Claude artifact source used as the comparison baseline (`artifact/`).
- Documentation: data quality and a [defect log](defect-log.md) (19 defects), the AI workflow, the storytelling pass,
  testing and QA, and a page-by-page and enterprise comparison with every row labelled tested, documented or not exercised.

## Corrections made after the first publish (credibility pass)
- "Same brief" is now "same scope": the artifact came first and set the scope and definitions, so matching numbers are not
  independent confirmation; `f1evo anchors` is.
- "Decision-grade" is now "trustworthy", defined as numbers verified and definitions documented, not production-deployed.
- The artifact link is described accurately: viewing requires being signed in to a Claude account.
- One reconciled defect log replaces counts that did not add up across documents.
- Dataset source and licence terms (Ergast CC BY-NC-SA, non-commercial) are stated.

## Known limits
No row-level security, scheduled refresh, deployment pipeline, phone layout or screen-reader pass. The Race & Circuit Explorer
opens empty until a race is chosen. See the README "Limits" section and `docs/ROADMAP-NEXT.md`.
The raw CSVs are not in the repository; the real-data checks run only on a machine that has them.
