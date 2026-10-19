# ADR-0008: Recompute the headline numbers in Python, outside Power BI

Status: accepted

## Context
DAX tested only by DAX shares the author's misunderstandings; the first build had exactly that failure.

## Decision
Add `f1evo anchors` and `f1evo data check`, which read the raw CSVs with pandas and compare with `data/expected.json`. Unit-test the rules on a hand-worked synthetic dataset.

## Consequences
- Result: the seven anchors and the Data Quality figures are reproducible by anyone with the CSVs and Python.
- Cost: two implementations of the same definitions must be kept in step; `docs/data-model.md` is the shared specification.
- Limit: it proves seven numbers, not every number on every page.
