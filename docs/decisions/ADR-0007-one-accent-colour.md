# ADR-0007: One accent colour on a dark background

Status: accepted

## Context
The first version used five colours with no rule.

## Decision
Keep the dark background, make everything grey, and use amber `#F5B301` only for the point of each chart that carries the story. Colour is chosen by measures (`Highlight colours` folder), so it follows the data.

## Consequences
- Follows the book's dark-background guidance and keeps text above 4.5:1 contrast.
- Cost: no colour coding for series on multi-line charts beyond amber, white and grey; direct labels are the next improvement.
- A colour measure is cached by name in Desktop; rename it to change what it returns.
