# ADR-0001: Build the report as PBIP, with the model as TMDL text

Status: accepted

## Context
An AI agent will do most of the editing, and the work must be reviewable and repeatable.

## Decision
Use the PBIP format: the semantic model as TMDL files and the report as PBIR JSON, edited as files and validated offline. Power BI Desktop renders the result; it is not an editing server.

## Consequences
- Good: diffs are readable; a generator can produce 268 visuals consistently; a lint can run in CI; the work is in Git.
- Good: edits do not depend on a live Desktop session, which stalled twice when used for bulk changes.
- Cost: Desktop strips the `$schema` line from two files on every save, and a hand-edited property name can break a page; both are caught by `f1evo pbip check`.
- Not covered: a `.pbix` binary is not produced or tracked.
