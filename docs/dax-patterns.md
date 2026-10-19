# DAX patterns that carry the report

Eight patterns, each quoted from the model (`powerbi/F1 Dataset.SemanticModel/definition/tables/`), each with the problem
it solves and the mistake it replaced. The conventions behind all 200 measures:

- Every measure has a `///` description and a display folder (the lint in `f1evo pbip check` enforces it).
- Ratios use `DIVIDE`, never `/`. Missing stays blank; it is never coerced to zero.
- Text a user reads (headlines, titles, banners, empty states) is a measure too, so it follows the filters.
- Hidden helper measures sit in the `Helpers` folder; visible ones are formatted once, on the measure.

## 1. Compare the first and last decade in view without losing the filter context
The Overview headline says how three rates moved between the first and last decade the user has selected. `KEEPFILTERS`
intersects the decade with the current selection instead of replacing it, so a driver or constructor filter still applies.

```dax
VAR _dec = FILTER(VALUES('Season'[Decade]), [Starts] >= 100)
VAR _a   = MINX(_dec, 'Season'[Decade])
VAR _b   = MAXX(_dec, 'Season'[Decade])
VAR _ra  = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Decade] = _a))
VAR _rb  = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Decade] = _b))
```
`[Starts] >= 100` keeps a decade with three races from becoming "the first decade". The full measure is `Headline Overview`
(see pattern 8 for the fallbacks).

## 2. Last complete season, without returning a table from IF
A title such as "Mechanical failures ended 38% of starts in 1950 and 4% in 2025" must not quote 2026, a season in progress.
My first version chose between two season lists with `IF`; DAX cannot return a table from `IF`, so six titles went blank.
The fix keeps one list and puts the fallback inside the filter condition:

```dax
VAR _all  = FILTER(VALUES('Season'[Season]), [Starts] > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _s    = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a    = MINX(_s, 'Season'[Season])
VAR _b    = MAXX(_s, 'Season'[Season])
```
If no season in view is complete, `_cmpN = 0` lets every season through, so the title still renders.
`Complete Flag` is a calculated column on `Season` (`1` when races with results equal races scheduled), so no year is
hard-coded and the next season rolls over by itself.

## 3. Titles from final standings, completed seasons only, with a constructor filter that means something
`Driver Titles` iterates seasons, takes the leader of the **last** standings snapshot, and counts it only if the season is
complete. When a constructor is selected it attributes each title to the team the champion drove for most that season
(`TOPN(1, ... [Starts] ...)`), so "titles won in Ferrari cars" is not a sum of every driver who ever raced for them.

```dax
SUMX(
    VALUES('Season'[Season]),
    VAR _complete = CALCULATE(MAX('Season'[Complete Flag])) = 1
    VAR _champ    = CALCULATE(MAXX(FILTER(VALUES('Driver'[Driver]), [Latest Driver Position] = 1), 'Driver'[Driver]),
                              REMOVEFILTERS('Constructor'))
    ...
    RETURN IF(_complete && NOT ISBLANK(_champ) && _inTeam, 1)
)
```
This replaced a count that included 2026 and reported 146 titles (77 + 69). The honest figure is 76 + 68 = 144 completed
seasons, and the first-principles Python check (`f1evo anchors`) agrees.

## 4. Top N with ranks that behave
Leaderboards are bar charts filtered to a rank measure, so the same visual re-ranks when the metric switch or any slicer
changes:

```dax
Driver Leaderboard Rank =
    IF([Leaderboard Value] > 0, RANKX(ALLSELECTED('Driver'[Driver]), [Leaderboard Value], , DESC, Skip))
```
`ALLSELECTED` ranks against the drivers the user left selected, not against everyone, and not against only the bar being
drawn. The visual filter is "rank is at most 10".

**Bug this exposed (also present in version 1):** the pit-time-by-constructor chart is filtered to "rank at most 6", and
the rank is blank for teams with fewer than 30 stops. Power BI's filter lets blanks through "at most N", so teams that
should have been excluded appeared. The fix is a second condition, "rank is at least 1", on the same visual.

## 5. One metric slicer, six measures: field parameters and dynamic formats
`Evolution Metric` is a field-parameter table; `Evolution Value` reads the user's choice and `formatStringDefinition`
switches the number format so a rate shows as a percentage and a count as an integer, in the same visual:

```tmdl
measure 'Evolution Value' = SWITCH(SELECTEDVALUE('Evolution Metric'[Evolution Metric Order], 0),
        0, [# Races Held], 1, [Starts], 2, [# Drivers Started],
        3, [# Constructors Started], 4, [Wins], 5, [Retirement Rate])
    displayFolder: Switches

    formatStringDefinition = IF(SELECTEDVALUE('Evolution Metric'[Evolution Metric Order], 0) = 5, "0%", "#,##0")
```
`SELECTEDVALUE` is applied to the **order** column, not to the display column: the display column is a composite key in a
field parameter and `SELECTEDVALUE` over it returns an error. In TMDL `formatStringDefinition` must be the **last**
property of the measure or Desktop refuses to open the project ("Invalid indentation").

## 6. Show a season in progress differently, with two series and no extra column
The line chart plots `Evolution Value (complete)` as a solid line and `Evolution Value (in progress)` as a dotted amber one.
The second measure returns the in-progress season plus the season before it so the dotted segment connects to the solid
line. The visual needs no filter, no helper table and no hard-coded year.

## 7. Colour that follows the data
The charts are grey; amber appears on the points that carry the story. Rather than colour bars by hand, a measure returns a
hex string and the visual's data-point fill reads it (`fx` on the bar colour):

```dax
Color Decade Ends =
    VAR _cur = MAX('Season'[Decade])
    VAR _dec = FILTER(ALLSELECTED('Season'[Decade], 'Season'[Era]), CALCULATE([Starts]) >= 100)
    VAR _a   = MINX(_dec, 'Season'[Decade])
    VAR _b   = MAXX(_dec, 'Season'[Decade])
    RETURN IF(_cur = _a || _cur = _b, "#F5B301", "#5B6470")
```
Select seasons 1990 to 2019 and the amber bars move to the 1990s and 2010s, because `ALLSELECTED` sees only the decades in
view. There are ten such measures (`Highlight colours` folder), for example the top driver, the peak season, the pole slot
and the fastest pit team. In my case Desktop kept drawing a status colour in its old shade after the measure's output
changed; defining the colour under a new measure name cleared it, so rename a colour measure when its output must refresh.

## 8. Text that explains itself: headlines, empty states, fallbacks
Headlines are measures with explicit fallbacks, in order: a comparison over a range of decades; a plain sentence for one
decade or one driver ("In view: 22 Grands Prix, 21 drivers; retirements ended 13% of starts and a pole won 52% of the time");
an empty-state message when the filters leave nothing.

```dax
Empty State Message =
    IF(COALESCE([Starts], 0) = 0,
       "No Grands Prix match this combination of filters. Remove a filter or press Reset filters.")

Partial Season Banner =
    VAR _p = FILTER(VALUES('Season'[Season]), CALCULATE(MIN('Season'[Complete Flag])) = 0 && [Starts] > 0)
    VAR _y = MAXX(_p, 'Season'[Season])
    RETURN IF(NOT ISBLANK(_y),
              "Season in progress: " & _y & " has " & LOOKUPVALUE('Season'[Races With Results], 'Season'[Season], _y)
              & " of " & LOOKUPVALUE('Season'[Races Scheduled], 'Season'[Season], _y)
              & " races run. It is included in counts but awards no title until it ends.", "")
```
Testing found two bugs here that no screenshot showed: a headline that read "the top driver's share of wins rose from 100% to
100%" when one driver was selected (the single-driver case now takes the plain sentence), and a blank headline for a single
season (no two decades to compare). Both are covered by the filter-state checks in `testing-and-qa.md`.

## Anti-patterns I removed
| Anti-pattern | Where it was | What replaced it |
|---|---|---|
| Counting rows and labelling them "drivers" | KPI cards (865 drivers, 213 constructors) | `Started` flag; 790 and 199 |
| Treating a season in progress as a champion | Titles and the champions table (146 titles) | `Complete Flag`; "(leader)" label |
| Trusting the numeric `position` column | 126 rows in 2025 to 2026 | Position text decides classified |
| Returning a table from `IF` | Six action titles | `FILTER` with the fallback in the condition |
| "Rank at most N" with blank ranks | Pit-time chart | Add "rank at least 1" |
| A dual-axis chart | Constructor trend, competitive balance | Two aligned charts sharing the season axis |
