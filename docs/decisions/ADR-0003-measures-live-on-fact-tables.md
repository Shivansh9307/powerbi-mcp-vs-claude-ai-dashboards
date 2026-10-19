# ADR-0003: Measures sit on the table they describe, mostly Race Results

Status: accepted

## Context
A model needs a place for its measures (200 when this was decided; 169 after the unused ones were removed).

## Decision
Measures live on the fact table whose data they describe (141 on Race Results, 12 on Pit Stops, and so on), grouped by display folder (Counts, Rates, Headlines, Action titles, Highlight colours, Data quality, Helpers).

## Consequences
- Good: a measure sits next to the columns it uses; display folders keep the field list navigable.
- Cost: Race Results carries most of the model's logic, and a dedicated measures table, which many teams prefer, would make the split clearer. Revisit if the model grows.
- The lint enforces a description and a display folder on every measure.
