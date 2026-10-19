# ADR-0002: A driver or constructor 'started' only if the car started

Status: accepted

## Context
The first build counted every result row as a driver, including cars that failed to qualify or withdrew: 865 drivers and 213 constructors.

## Decision
Define a **start** as a result whose position text is not `F` or `W`. KPIs, rates and rankings count starts. Retired and disqualified cars did start. Both numbers are recomputed in Python.

## Consequences
- Result: 790 drivers and 199 constructors; every rate is per start.
- A shared drive counts as one race but two starts, so wins (1,169) exceed races (1,166).
- The position text, not the numeric `position` column, decides classified finishes (126 rows differ in 2025 to 2026).
