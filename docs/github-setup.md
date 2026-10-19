# GitHub setup kit

Copy-paste text and the manual steps for the repository page. Nothing here is applied automatically.

## Description (repository "About")
```
Two AI-built F1 dashboards, one human review: Power BI (Claude Code + Power BI authoring MCP) vs a Claude artifact. Audited, independently re-computed in Python, linted in CI and compared page by page, with the limits stated.
```

## Topics
Existing (11, read from the repository on 2026-10-19): `power-bi`, `dax`, `tmdl`, `pbip`, `claude-code`, `mcp`, `claude-artifacts`,
`data-storytelling`, `data-visualization`, `formula-1`, `uv`.

Add (4): `business-intelligence`, `semantic-model`, `ai-assisted-development`, `claude`.

```powershell
gh repo edit --add-topic business-intelligence --add-topic semantic-model --add-topic ai-assisted-development --add-topic claude
```

## Manual steps
1. **Website field: leave it empty, or set it to `docs/comparison/` on GitHub** (for example
   `https://github.com/Shivansh9307/powerbi-mcp-vs-claude-ai-dashboards/tree/main/docs/comparison`). Do **not** use the Claude
   artifact link: it can be viewed only by people signed in to a Claude account, so a recruiter would land on a sign-in wall.
2. **Social preview:** Settings > General > Social preview > Upload an image > `docs/images/social-preview.png`
   (1280 by 640 px, under 1 MB).
3. **Pin to profile:** your profile page > Customize your pins > tick this repository.
4. **Draft release:** Releases > Draft a new release > tag `v1.0.0` on `main`, title "v1.0.0: F1 Evolution", paste
   [`release-notes-v1.0.0.md`](release-notes-v1.0.0.md), leave it as a **draft** until you have re-read it, then publish.
   CLI equivalent (draft only): `gh release create v1.0.0 --draft --notes-file docs/release-notes-v1.0.0.md`.

## One line for the post
> The artifact opens for anyone signed in to Claude; screenshots are in the repo.
