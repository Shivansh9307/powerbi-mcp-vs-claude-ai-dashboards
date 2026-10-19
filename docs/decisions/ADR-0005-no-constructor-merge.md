# ADR-0005: Constructor renames are not merged

Status: accepted

## Context
Teams change names, and the source holds Lotus, Lotus F1 and Team Lotus as three ids. The source has no lineage field.

## Decision
Treat every constructor id as its own entity. List possible same-name families on the Data Quality page as a hint only.

## Consequences
- Good: nothing is merged on a guess; every number traces to the source.
- Cost: a 'team' that was renamed appears as several entities with shorter histories; the 199 constructors are ids, not organisations.
