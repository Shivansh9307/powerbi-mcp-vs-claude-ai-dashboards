# Enterprise reporting matrix: Power BI report vs Claude artifact

The page-by-page comparison asks "which page tells the story better?". This one asks what a BI lead asks before putting
a report in front of a business: who can see what, how it refreshes, how it ships, who maintains it, what it costs.

**Evidence labels** (every row carries one; read them before you trust a row):

| Label | Meaning |
|---|---|
| **T** | Tested here: I built, ran or measured it in this project |
| **A** | Follows from the architecture I can see in the files (for example the artifact is static JavaScript over uploaded CSVs) |
| **D** | Documented by the vendor; I did not exercise it. Product features and licensing change, so verify against current Microsoft and Anthropic documentation before relying on a row |
| **N** | Not exercised and I have no basis to judge |

## Summary by audience
| If the reader is... | Prefer | Because |
|---|---|---|
| A business user who needs one clear story fast | Artifact, or the Power BI report once the three follow-ups in `page-by-page.md` are done | Denser narrative, always-populated default states, definitions at the point of use |
| A team that must govern, secure and refresh a report | Power BI | Semantic model, security roles, scheduled refresh, deployment and audit exist as features |
| An analyst extending the metrics | Power BI | Change a measure once; every report on the model follows |
| An executive who wants a link they can open today | Artifact | No licence, no workspace; a signed-in account and a link |

## 1. Data and model
| Requirement | Power BI report | Claude artifact | Evidence |
|---|---|---|---|
| Where the logic lives | 169 DAX measures in a semantic model (TMDL), reusable by other reports and Excel | 2,289 lines of bespoke JavaScript (`artifact/src/*.js`, `wc -l`) and a Python prep step | T (both inspected) |
| Metric definitions visible to consumers | Description on every measure; lineage in the model | Info icon on each metric; `DATA_DICTIONARY.md` | T |
| Change a definition | Edit one measure; every visual and report on the model changes | Edit JavaScript, rerun tests, republish | A |
| Data volume | 885,381 lap rows loaded as 883,402; VertiPaq compressed cache about 5.7 MB at the last save | Laps pre-aggregated to one row per race and driver in the prep step; 17 CSVs, 2.9 MB in total | T (sizes measured) |
| Grain flexibility | Any lap-level question the model supports | Only what the prep step kept | A |
| Reconciliation tests | `f1evo anchors` (7 numbers) and `f1evo data check` (14 files), outside Power BI; DAX checks at 19 filter states | 13 Node tests defined in `artifact/tests/reconcile.test.js`, including "every page renders for 8 filter states without NaN"; not run in the latest review (no raw CSVs available) | T (`f1evo`, run during the build); A (Node tests, not re-run) |

## 2. Connectivity and refresh
| Requirement | Power BI report | Claude artifact | Evidence |
|---|---|---|---|
| Update with new races | Refresh the model; Import mode reloads the CSVs | Re-run `prep_data.py`, then re-upload the changed CSVs and update each dataset's stamp (`artifact/README.md`) | T (Power BI refresh); A (artifact, from its README) |
| Scheduled refresh | Available for a published model; a laptop folder needs a gateway or a cloud location | None built in: "a fixed snapshot; it does not pull new data on its own" | D (Power BI); A (artifact) |
| Live connection to a shared model | A thin report can connect live to a published semantic model | Not applicable; the data travels with the page | D |
| DirectQuery or Direct Lake | Possible if the data moved to a warehouse or lakehouse; Import was the right choice for about 1.0 M raw rows | Not applicable | D |
| Incremental refresh | Available; the lap table is the candidate | Not applicable | D, N |
| Runtime data connections for artifacts | n/a | The artifact tool documents runtime capabilities (for example a small database and connected data); this artifact uses none | D |

## 3. Security and governance
| Requirement | Power BI report | Claude artifact | Evidence |
|---|---|---|---|
| Row-level security | Roles with DAX filters, including dynamic RLS from the signed-in user, on the semantic model. **Not configured** in this project (public sports data) | No row-level concept. Everyone who can open the artifact receives all of its data in the browser | D (Power BI); A (artifact) |
| Object-level or column security | Available on the model | None | D |
| Who can open it | Workspace roles, apps, per-item permissions, sharing links; B2B guests | Viewable only by people signed in to a Claude account: a signed-out visitor sees an empty dashboard and "Sign in to see this artifact's data" (observed 2026-10-19). Other sharing options are the platform's | T (sign-in wall); D (sharing options) |
| Sensitivity labels, DLP, Purview lineage | Available in a tenant that enables them | Not applicable | D |
| Certification and endorsement | Promoted or certified item in a workspace | None | D |
| Audit and usage | Activity log and usage metrics for published content | Not exposed in what I inspected | D, N |
| Data residency and compliance | Governed by the tenant's region and agreements | Governed by the claude.ai service terms | N |
| Public data only? | Fine either way here | Fine here; for confidential data the "everything is in the page" design is the deciding risk | A |

## 4. Authoring, publishing and maintenance
| Requirement | Power BI report | Claude artifact | Evidence |
|---|---|---|---|
| Time to a first useful page | Longer: a model, relationships and measures come first | Shorter: one HTML page over prepared CSVs | N (I did not time either; this is the usual shape, not a measurement) |
| Version control | PBIP: model as TMDL, report as PBIR JSON; diffable and lintable; Git integration is a documented feature | Source files in a folder; the platform keeps versions of the published page | T (files linted and committed in this repo); D |
| CI/CD | Deployment pipelines (dev, test, prod) and Fabric Git integration are available; **not exercised** here | Republish the page | D, N |
| Automated checks | `f1evo pbip check` in CI: documentation on every measure, no broken field references, no private paths | `node tests/reconcile.test.js` | T |
| Publishing | A workspace item; "Publish" from Desktop or deploy from Git; needs a licence for viewers on a shared workspace | A link; viewers must be signed in to a Claude account, so it cannot serve as a demo for readers without an account (sign-in wall observed 2026-10-19) | D (Power BI); T (sign-in wall) |
| Bus factor | Another BI developer can open the PBIP and read standard artefacts | Another developer must read the custom JavaScript | A |
| Edit by non-developers | Power BI Desktop, Analyze in Excel, the model's measures | Ask an AI or a developer to edit code | A |
| AI authoring experience | Needs a toolchain (modeling MCP, CLI, Desktop) and guardrails; Desktop stalled twice (`../lessons-desktop-stalls.md`) | Fast and forgiving; one file, one preview | T (this project) |

## 5. Consumption features
| Requirement | Power BI report | Claude artifact | Evidence |
|---|---|---|---|
| Drill-through, cross-filter, sync slicers, bookmarks | Native; drill-through and sync slicers built here | Custom click handlers and a global toolbar | T |
| Export | "Export data" on visuals (tenant-controlled); paginated reports for print layouts | "Export CSV" on every table; browser print | D (Power BI); T (artifact screenshots show the buttons) |
| Subscriptions and alerts | Email subscriptions and data alerts on supported content | None | D |
| Mobile layout | A phone layout can be authored; **not built** | Responsive CSS: not tested at phone width | N |
| Embedding | Embed in apps or portals with the right licensing | Open the link; embedding not assessed | D, N |
| Natural-language Q&A and Copilot | Available on a published semantic model in an enabled tenant | None | D |
| Excel and other reports on the same model | Analyze in Excel and composite models | None | D |
| Accessibility | Alt text on every non-decorative visual (lint-checked), title and reading order authored; screen-reader pass **not** done | ARIA labels and keyboard focus in source; not tested | T (alt text); N (screen-reader) |
| Offline use | Desktop works offline on a loaded model | Needs the browser page and (for the preview) a CDN for d3 | T (preview needed internet for d3) |

## 6. Cost and scale
| Requirement | Power BI report | Claude artifact | Evidence |
|---|---|---|---|
| Licensing | Viewers on shared content generally need a Pro, Premium Per User or capacity licence; Desktop is free. Check current pricing | Included with the Claude account that publishes it | D |
| Scale ceiling | Model size and capacity limits are documented per SKU; 885 k rows is far below any limit | Bounded by what a browser can load and compute in-page; the lap table is pre-aggregated because of it | D (Power BI); A (artifact) |
| Operating effort | A workspace, refresh credentials, a gateway if the source is local | None, until the data changes | A |

## Things an enterprise review often asks that neither build covers
These are not gaps in the comparison, they are gaps in both builds, listed so nobody assumes otherwise:
deployment pipelines across environments; incremental refresh on the lap table; aggregations or composite models;
object-level security; a certified endorsement process; alerts and subscriptions; a paginated board pack; embedding;
a documented backup and disaster-recovery plan; localisation; a service-level agreement and support path; a formal WCAG
audit; penetration or privacy review. `../../README.md` lists the ones I would add first.

## What would change my recommendation
- **The data becomes confidential or user-specific:** Power BI with RLS, and the artifact is out.
- **The audience is five people for one meeting:** the artifact, and keep the Power BI model as the source of truth if it will live on.
- **The metrics will keep changing, or other reports need them:** Power BI, because one measure feeds everything.
- **Someone must prove what changed and when:** both can be version-controlled, but only the Power BI side has a model and a report as separate reviewable files in this project.
