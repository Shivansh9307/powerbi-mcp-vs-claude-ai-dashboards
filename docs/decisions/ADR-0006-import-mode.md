# ADR-0006: Import mode, not DirectQuery or Direct Lake

Status: accepted

## Context
About one million raw rows from CSV files on disk.

## Decision
Import all tables. The model is small (about 5.7 MB cached), refresh is fast, and every DAX feature is available.

## Consequences
- Good: simplest; fastest to query; no source system to keep online.
- Cost: a scheduled refresh needs a gateway or a cloud location for the CSVs; incremental refresh on the lap table would be the first optimisation. Not exercised here (see `comparison/enterprise-matrix.md`).
