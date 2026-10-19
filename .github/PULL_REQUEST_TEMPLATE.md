## What changed and why

## Checks
- [ ] `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest`
- [ ] `uv run f1evo pbip check powerbi` shows 0 errors
- [ ] If a measure changed: description and display folder updated, `docs/data-model.md` still true
- [ ] If numbers changed: `uv run f1evo anchors --raw <csv folder>` still matches `data/expected.json`
- [ ] If a page changed: before and after screenshots attached
