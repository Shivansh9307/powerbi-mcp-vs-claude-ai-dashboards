// Measures to inject (table -> list).
const R = String.raw;
const EVO = "SELECTEDVALUE('Evolution Metric'[Evolution Metric Order], 0)";
const evoFmt = R`IF(${EVO} = 5, "0%", "#,##0")`;
const LB = "SELECTEDVALUE('Leaderboard Metric'[Leaderboard Metric Order], 0)";
const CM = "SELECTEDVALUE('Constructor Metric'[Constructor Metric Order], 0)";
const rr = [];
const m = (list, o) => list.push(o);

m(rr, { name: 'Evolution Value', folder: 'Switches', fmt: '#,##0', fmtExpr: evoFmt, desc: 'Value of the metric chosen in the Evolution Metric selector (Grands Prix, Starts, Drivers, Constructors, Wins or Retirement rate). Shows Grands Prix when nothing is chosen. Seasons still in progress are drawn separately by Evolution Value (in progress).', expr: `SWITCH(${EVO}, 0, [# Races Held], 1, [Starts], 2, [# Drivers Started], 3, [# Constructors Started], 4, [Wins], 5, [Retirement Rate])` });
m(rr, { name: 'Evolution Value (complete)', folder: 'Switches', fmt: '#,##0', fmtExpr: evoFmt, desc: 'Evolution Value for seasons whose calendar is complete.', expr: 'IF(COALESCE(CALCULATE(MIN(\'Season\'[Complete Flag])), 1) = 1, [Evolution Value])' });
m(rr, { name: 'Evolution Value (in progress)', folder: 'Switches', fmt: '#,##0', fmtExpr: evoFmt, desc: 'Evolution Value for a season still in progress, plus the season before it so the dotted line connects. Partial seasons are therefore visually distinct.', expr: R`VAR _s = MAX('Season'[Season])
VAR _nextComplete = LOOKUPVALUE('Season'[Complete Flag], 'Season'[Season], _s + 1)
VAR _thisComplete = CALCULATE(MIN('Season'[Complete Flag]))
RETURN IF(_thisComplete = 0 || _nextComplete = 0, [Evolution Value])` });
m(rr, { name: 'Evolution Title', folder: 'Messages', fmt: '@', desc: 'Chart title that follows the metric switch and flags an in-progress season.', expr: R`"Evolution by season: " & SWITCH(${EVO}, 0, "Grands Prix", 1, "starts", 2, "drivers", 3, "constructors", 4, "wins", 5, "retirement rate") & IF([In-progress Seasons in View] > 0, " (dotted: season in progress)", "")` });
m(rr, { name: 'Leaderboard Value', folder: 'Switches', fmt: '#,##0', fmtExpr: R`IF(${LB} = 4, "#,##0.#", "#,##0")`, desc: 'Value of the metric chosen in the Leaderboard Metric selector (Wins, Podiums, Poles, Titles, Points or Starts) for each driver. Wins when nothing is chosen.', expr: `SWITCH(${LB}, 0, [Wins], 1, [Podiums], 2, [Pole Positions], 3, [Titles], 4, [Recorded Points], 5, [Starts])` });
m(rr, { name: 'Driver Leaderboard Rank', folder: 'Helpers', fmt: '0', hidden: true, desc: 'Rank of each driver by the chosen leaderboard metric within the current selection. Keeps the top rows in the driver leaderboards.', expr: "IF([Leaderboard Value] > 0, RANKX(ALLSELECTED('Driver'[Driver]), [Leaderboard Value], , DESC, Skip))" });
m(rr, { name: 'Constructor Leaderboard Value', folder: 'Switches', fmt: '#,##0', fmtExpr: R`IF(${CM} = 4, "#,##0.#", "#,##0")`, desc: 'Value of the metric chosen in the Constructor Metric selector for each constructor. Titles here are the constructors\' championship; Wins when nothing is chosen.', expr: `SWITCH(${CM}, 0, [Wins], 1, [Podiums], 2, [Pole Positions], 3, [Constructor Titles], 4, [Recorded Points], 5, [Starts])` });
m(rr, { name: 'Constructor Leaderboard Rank', folder: 'Helpers', fmt: '0', hidden: true, desc: 'Rank of each constructor by the chosen metric within the current selection.', expr: "IF([Constructor Leaderboard Value] > 0, RANKX(ALLSELECTED('Constructor'[Constructor]), [Constructor Leaderboard Value], , DESC, Skip))" });
m(rr, { name: 'Driver Points Rank', folder: 'Helpers', fmt: '0', hidden: true, desc: 'Rank of each driver by recorded points within the current selection.', expr: "IF([Recorded Points] > 0, RANKX(ALLSELECTED('Driver'[Driver]), [Recorded Points], , DESC, Skip))" });
m(rr, { name: 'Leaderboard Title Drivers', folder: 'Messages', fmt: '@', desc: 'Driver leaderboard title that follows the metric switch.', expr: R`"Drivers ranked by " & SWITCH(${LB}, 0, "wins", 1, "podiums", 2, "poles", 3, "titles", 4, "points", 5, "starts") & " (top 10)"` });
m(rr, { name: 'Leaderboard Title Constructors', folder: 'Messages', fmt: '@', desc: 'Constructor leaderboard title that follows the metric switch.', expr: R`"Constructors ranked by " & SWITCH(${CM}, 0, "wins", 1, "podiums", 2, "poles", 3, "constructors' titles", 4, "points", 5, "starts") & " (top 10)"` });
m(rr, { name: 'Other Retirement Rate', folder: 'Rates', fmt: '0.0%', desc: 'Share of starts that ended in another retirement: not classified, withdrew, injury, illness or safety.', expr: R`DIVIDE(CALCULATE(COUNTROWS('Race Results'), 'Race Results'[Status Group] = "Other DNF"), [Starts])` });
m(rr, { name: 'First Season', folder: 'Career', fmt: '0', desc: 'First season with a start in the selection.', expr: "MINX(FILTER('Race Results', 'Race Results'[Started]), RELATED('Race'[Season Year]))" });
m(rr, { name: 'Last Season', folder: 'Career', fmt: '0', desc: 'Last season with a start in the selection.', expr: "MAXX(FILTER('Race Results', 'Race Results'[Started]), RELATED('Race'[Season Year]))" });
m(rr, { name: 'Selected Driver Name', folder: 'Messages', fmt: '@', desc: 'Name of the selected driver, or a note that several or all drivers are in view.', expr: R`IF(HASONEVALUE('Driver'[Driver]), VALUES('Driver'[Driver]), IF(ISFILTERED('Driver'[Driver]), COUNTROWS(VALUES('Driver'[Driver])) & " drivers selected", "All drivers"))` });
m(rr, { name: 'Selected Constructor Name', folder: 'Messages', fmt: '@', desc: 'Name of the selected constructor, or a note that several or all constructors are in view.', expr: R`IF(HASONEVALUE('Constructor'[Constructor]), VALUES('Constructor'[Constructor]), IF(ISFILTERED('Constructor'[Constructor]), COUNTROWS(VALUES('Constructor'[Constructor])) & " constructors selected", "All constructors"))` });
m(rr, { name: 'Compare Driver Name', folder: 'Head to head', fmt: '@', desc: 'Name of the driver chosen for comparison.', expr: R`COALESCE(SELECTEDVALUE('Compare Driver'[Compare Driver]), "No second driver chosen")` });
m(rr, { name: 'H2H Races Both Started', folder: 'Head to head', fmt: '#,##0', desc: 'Grands Prix in view that both the selected driver and the comparison driver started. Blank until two different drivers are chosen.', expr: R`VAR _a = SELECTEDVALUE('Driver'[Driver])
VAR _b = SELECTEDVALUE('Compare Driver'[Compare Driver])
RETURN IF(ISBLANK(_a) || ISBLANK(_b) || _a = _b, BLANK(), COUNTROWS(FILTER(VALUES('Race'[Race Id]), CALCULATE(COUNTROWS('Race Results'), 'Race Results'[Started] = TRUE(), 'Driver'[Driver] = _a) > 0 && CALCULATE(COUNTROWS('Race Results'), 'Race Results'[Started] = TRUE(), 'Driver'[Driver] = _b) > 0)))` });
const h2h = (cmp) => R`VAR _a = SELECTEDVALUE('Driver'[Driver])
VAR _b = SELECTEDVALUE('Compare Driver'[Compare Driver])
RETURN IF(ISBLANK(_a) || ISBLANK(_b) || _a = _b, BLANK(), SUMX(VALUES('Race'[Race Id]), VAR _pa = CALCULATE(MIN('Race Results'[Classification Order]), 'Race Results'[Started] = TRUE(), 'Driver'[Driver] = _a) VAR _pb = CALCULATE(MIN('Race Results'[Classification Order]), 'Race Results'[Started] = TRUE(), 'Driver'[Driver] = _b) RETURN IF(NOT ISBLANK(_pa) && NOT ISBLANK(_pb) && ${cmp}, 1, 0)))`;
m(rr, { name: 'H2H Driver Ahead', folder: 'Head to head', fmt: '#,##0', desc: 'Races both drivers started in which the selected driver was placed ahead (lower classification order, so retirements are ranked by distance covered).', expr: h2h('_pa < _pb') });
m(rr, { name: 'H2H Compare Ahead', folder: 'Head to head', fmt: '#,##0', desc: 'Races both drivers started in which the comparison driver was placed ahead.', expr: h2h('_pb < _pa') });
m(rr, { name: 'Field Context', folder: 'Messages', fmt: '@', desc: 'Where the selected driver ranks by wins among all drivers who started in the same seasons and filters.', expr: R`VAR _name = SELECTEDVALUE('Driver'[Driver])
VAR _w = [Wins]
VAR _rank = RANKX(ALL('Driver'[Driver]), [Wins], _w, DESC, Skip)
VAR _field = CALCULATE([# Drivers Started], REMOVEFILTERS('Driver'))
RETURN IF(NOT ISBLANK(_name) && _field > 0, _name & " ranks " & _rank & " of " & FORMAT(_field, "#,##0") & " drivers by wins in the seasons and filters in view.", "Choose one driver to see how they rank among the " & FORMAT(_field, "#,##0") & " drivers in view.")` });
m(rr, { name: 'Result Label', folder: 'Labels', fmt: '@', desc: 'Finishing position as text, or why there is none: Retired, Disqualified, Excluded, Withdrawn, Did not qualify or Not classified.', expr: R`VAR _f = MAX('Race Results'[Finish Position])
VAR _t = SELECTEDVALUE('Race Results'[Position Text])
RETURN IF(NOT ISBLANK(_f), FORMAT(_f, "0"), SWITCH(_t, "R", "Retired", "D", "Disqualified", "E", "Excluded", "W", "Withdrawn", "F", "Did not qualify", "N", "Not classified", BLANK()))` });
m(rr, { name: 'Position Change Count', folder: 'Counts', fmt: '#,##0', desc: 'Classified starts with a recorded grid, used for the distribution of positions gained or lost.', expr: "CALCULATE(COUNTROWS('Race Results'), NOT ISBLANK('Race Results'[Position Change]))" });
m(rr, { name: 'Winner Grid Slot', folder: 'Rates', fmt: '0.0', desc: 'Mean starting slot of the winners in view. Winners with a grid of 0 (pit lane or unrecorded) or a missing grid are left out.', expr: "CALCULATE(AVERAGE('Race Results'[Grid Position]), 'Race Results'[Finish Position] = 1, 'Race Results'[Grid Position] >= 1)" });
m(rr, { name: 'Winners from Pole Share', folder: 'Rates', fmt: '0%', desc: 'Share of wins that came from pole position.', expr: "DIVIDE(CALCULATE(COUNTROWS('Race Results'), 'Race Results'[Finish Position] = 1, 'Race Results'[Grid Position] = 1), [Wins])" });
m(rr, { name: 'Cmp Points A', folder: 'Head to head', fmt: '#,##0.#', desc: 'Points of the selected constructor in the season in view.', expr: '[Recorded Points]' });
m(rr, { name: 'Cmp Points B', folder: 'Head to head', fmt: '#,##0.#', desc: 'Points of the comparison constructor in the season in view.', expr: R`VAR _b = SELECTEDVALUE('Compare Constructor'[Compare Constructor])
RETURN IF(NOT ISBLANK(_b), CALCULATE([Recorded Points], REMOVEFILTERS('Constructor'), 'Constructor'[Constructor] = _b))` });
m(rr, { name: 'Cmp Wins A', folder: 'Head to head', fmt: '#,##0', desc: 'Wins of the selected constructor in the season in view.', expr: '[Wins]' });
m(rr, { name: 'Cmp Wins B', folder: 'Head to head', fmt: '#,##0', desc: 'Wins of the comparison constructor in the season in view.', expr: R`VAR _b = SELECTEDVALUE('Compare Constructor'[Compare Constructor])
RETURN IF(NOT ISBLANK(_b), CALCULATE([Wins], REMOVEFILTERS('Constructor'), 'Constructor'[Constructor] = _b))` });
m(rr, { name: 'Cmp Ahead', folder: 'Head to head', fmt: '@', desc: 'Which of the two constructors scored the higher era-normalised points share in the season. Blank when neither raced.', expr: R`VAR _b = SELECTEDVALUE('Compare Constructor'[Compare Constructor])
VAR _a = SELECTEDVALUE('Constructor'[Constructor])
VAR _na = [Era-Normalised Points]
VAR _nb = IF(NOT ISBLANK(_b), CALCULATE([Era-Normalised Points], REMOVEFILTERS('Constructor'), 'Constructor'[Constructor] = _b))
RETURN IF(ISBLANK(_na) && ISBLANK(_nb), BLANK(), IF(ISBLANK(_nb) || _na > _nb, _a, IF(ISBLANK(_na) || _nb > _na, _b, "Level")))` });
m(rr, { name: 'Compare Constructor Name', folder: 'Head to head', fmt: '@', desc: 'Name of the constructor chosen for comparison.', expr: R`COALESCE(SELECTEDVALUE('Compare Constructor'[Compare Constructor]), "No second constructor chosen")` });
m(rr, { name: 'Constructor Title Note', folder: 'Messages', fmt: '@', desc: 'Reminder of when constructors\' titles exist.', expr: R`VAR _hi = MAX('Season'[Season])
VAR _lo = MIN('Season'[Season])
RETURN IF(_hi < 1958, "The constructors' championship did not exist before 1958, so no team titles are shown.", IF(_lo < 1958, "The constructors' championship starts in 1958; earlier seasons are not awarded.", "Titles are counted from final standings of completed seasons only."))` });
m(rr, { name: 'Laps Led', folder: 'Race pace', fmt: '#,##0', desc: 'Laps run in first place, from the lap-by-lap record (available from 1982). Counts laps recorded, so an unrecorded lap is not a lap led.', expr: "CALCULATE(COUNTROWS('Lap Times'), 'Lap Times'[Running Position] = 1)" });
m(rr, { name: 'Laps Led Rank', folder: 'Helpers', fmt: '0', hidden: true, desc: 'Rank of each driver by laps led within the current selection.', expr: "IF([Laps Led] > 0, RANKX(ALLSELECTED('Driver'[Driver]), [Laps Led], , DESC, Skip))" });
m(rr, { name: 'Median Lap (s)', folder: 'Race pace', fmt: '0.0', desc: 'Median lap time of all recorded laps in the selection. The circuits visited change from season to season, so compare it as a direction of travel, not exactly.', expr: "DIVIDE(MEDIAN('Lap Times'[Lap Time (ms)]), 1000)" });
m(rr, { name: 'Lap Data Coverage', folder: 'Race pace', fmt: '0%', desc: 'Share of Grands Prix in view that have lap-by-lap data.', expr: "DIVIDE(CALCULATE(COUNTROWS(FILTER(VALUES('Race'[Race Id]), CALCULATE(COUNTROWS('Lap Times')) > 0))), [# Races Held])" });
m(rr, { name: 'Lap Coverage Message', folder: 'Messages', fmt: '@', desc: 'Coverage note for race-pace visuals.', expr: R`VAR _c = [Lap Data Coverage]
VAR _first = MINX('Lap Times', RELATED('Race'[Season Year]))
RETURN IF(COALESCE(_c, 0) = 0, "No lap data in these seasons. Lap times are recorded from 1982.", FORMAT(_c, "0%") & " of Grands Prix in view have lap data (first season with laps: " & _first & ").")` });
m(rr, { name: 'Season Winners Distinct', folder: 'Competitive balance', fmt: '#,##0', desc: 'Different drivers who won a Grand Prix in the season (competitive balance).', expr: '[# Race Winners]' });
m(rr, { name: 'Cars per Race', folder: 'Counts', fmt: '0.0', desc: 'Average number of cars that started each Grand Prix.', expr: 'DIVIDE([Starts], [# Races Held])' });
m(rr, { name: 'Top Scorer Era-Normalised', folder: 'Points', fmt: '0%', desc: 'Best era-normalised points share among drivers with at least 30 starts in the selection: points as a share of the maximum available to a winner of every race.', expr: "MAXX(FILTER(VALUES('Driver'[Driver]), [Starts] >= 30), [Era-Normalised Points])" });
m(rr, { name: 'Scoring Changes Detected', folder: 'Messages', fmt: '0', desc: 'Seasons in view whose win or runner-up points differ from the previous season.', expr: "COUNTROWS(FILTER(VALUES('Season'[Season]), CALCULATE(MAX('Season'[Scoring Changed])) = TRUE()))" });
// coverage by table (share of scheduled races that have rows), for the data-quality heat matrix
const cov = (label, table, desc) => m(rr, { name: `Coverage ${label}`, folder: 'Coverage', fmt: '0%', desc, expr: `DIVIDE(COUNTROWS(FILTER(VALUES('Race'[Race Id]), CALCULATE(COUNTROWS('${table}')) > 0)), COUNTROWS('Race'))` });
cov('Results', 'Race Results', 'Share of scheduled races that have race results.');
cov('Sprint', 'Sprint Results', 'Share of scheduled races that have sprint results. Sprints only exist at some weekends, so a low value is normal.');
cov('Qualifying', 'Qualifying', 'Share of scheduled races that have qualifying records.');
cov('Laps', 'Lap Times', 'Share of scheduled races that have lap-by-lap times.');
cov('Pit Stops', 'Pit Stops', 'Share of scheduled races that have pit-stop records.');
cov('Driver Standings', 'Driver Standings', 'Share of scheduled races that have a drivers\' standings snapshot.');
cov('Constructor Standings', 'Constructor Standings', 'Share of scheduled races that have a constructors\' standings snapshot (from 1958).');
cov('Constructor Results', 'Constructor Results', 'Share of scheduled races that have constructor result rows.');
m(rr, { name: 'Official Points Total', folder: 'Data quality', fmt: '#,##0.#', desc: 'Sum of every driver\'s final official championship points for the season in view.', expr: "SUMX(ALL('Driver'[Driver]), [Latest Driver Points])" });
m(rr, { name: 'Recorded Points All Drivers', folder: 'Data quality', fmt: '#,##0.#', desc: 'Sum of race and sprint points of all drivers for the season in view, ignoring any driver or constructor filter.', expr: "CALCULATE([Recorded Points], REMOVEFILTERS('Driver'), REMOVEFILTERS('Constructor'))" });
m(rr, { name: 'Standings Gap', folder: 'Data quality', fmt: '+#,##0.#;-#,##0.#;0', desc: 'Recorded points minus official standings points. Non-zero values are expected where championships dropped worst results, and for seasons in progress.', expr: '[Recorded Points All Drivers] - [Official Points Total]' });
m(rr, { name: 'Standings Gap Status', folder: 'Data quality', fmt: '@', desc: 'Pass when recorded points equal official points, Warn when they differ by less than 10%, Fail otherwise.', expr: R`VAR _g = ABS([Standings Gap])
VAR _o = [Official Points Total]
RETURN IF(ISBLANK(_o), BLANK(), IF(_g < 0.5, "Pass", IF(DIVIDE(_g, _o) < 0.1, "Warn", "Fail")))` });

const ps = [];
m(ps, { name: 'Typical Pit Time (s)', folder: 'Pit lane', fmt: '0.0', desc: 'Median time in the pit lane from entry to exit, over stops of 60 seconds or less. This is pit-lane time, not the stationary tyre change, which is not in the data.', expr: "DIVIDE(CALCULATE(MEDIAN('Pit Stops'[Pit Stop Duration (ms)]), 'Pit Stops'[Pit Stop Duration (ms)] <= 60000), 1000)" });
m(ps, { name: 'Extended Stops', folder: 'Pit lane', fmt: '#,##0', desc: 'Stops longer than 60 seconds in the pit lane, such as repairs or red-flag stops. Left out of typical time.', expr: "CALCULATE(COUNTROWS('Pit Stops'), 'Pit Stops'[Pit Stop Duration (ms)] > 60000)" });
m(ps, { name: 'Cars in Races With Pit Data', folder: 'Pit lane', fmt: '#,##0', desc: 'Starts in Grands Prix that have pit-stop records. Denominator for stops per car, so seasons without pit data do not dilute it.', expr: "CALCULATE([Starts], FILTER(VALUES('Race'[Race Id]), CALCULATE(COUNTROWS('Pit Stops')) > 0))" });
m(ps, { name: 'Stops per Car', folder: 'Pit lane', fmt: '0.00', desc: 'Pit stops divided by cars that started, counted only in races with pit-stop records.', expr: 'DIVIDE([# Pit Stops], [Cars in Races With Pit Data])' });
m(ps, { name: 'Pit First Season', folder: 'Pit lane', fmt: '0', desc: 'First season in view with pit-stop records.', expr: "MINX('Pit Stops', RELATED('Race'[Season Year]))" });
m(ps, { name: 'Pit Seasons in View', folder: 'Pit lane', fmt: '0', desc: 'Seasons in view that have pit-stop records.', expr: "COUNTROWS(FILTER(VALUES('Season'[Season]), CALCULATE(COUNTROWS('Pit Stops')) > 0))" });
m(ps, { name: 'Pit Scope Message', folder: 'Messages', fmt: '@', desc: 'Scope indicator: how many seasons in view have pit-stop records, and a pointer to the fallback when none do.', expr: R`VAR _n = [Pit Seasons in View]
VAR _all = COUNTROWS(FILTER(VALUES('Season'[Season]), CALCULATE([# Races Held]) > 0))
RETURN IF(COALESCE(_n, 0) = 0, "No pit-stop records in these seasons. Pit stops are recorded from 1994, so the chart on the right shows how starts ended instead.", "Pit-stop records cover " & _n & " of " & _all & " seasons in view, from " & [Pit First Season] & ". Times are entry-to-exit pit-lane time, not the stationary stop.")` });
m(ps, { name: 'Constructor Pit Time Rank', folder: 'Helpers', fmt: '0', hidden: true, desc: 'Rank of each constructor by typical pit-lane time (fastest first), only for constructors with at least 30 stops in view.', expr: "IF([# Pit Stops] >= 30, RANKX(FILTER(ALLSELECTED('Constructor'[Constructor]), [# Pit Stops] >= 30), [Typical Pit Time (s)], , ASC, Skip))" });

const q = [];
m(q, { name: 'Qualifying Entries', folder: 'Qualifying', fmt: '#,##0', desc: 'Qualifying results with a recorded lap time.', expr: "COUNTROWS(FILTER('Qualifying', NOT ISBLANK('Qualifying'[Best Qualifying Time (ms)])))" });
m(q, { name: 'Quali Poles', folder: 'Qualifying', fmt: '#,##0', desc: 'Sessions in which the driver or team was fastest in qualifying. Can differ from Pole Positions, which uses the race grid after penalties.', expr: "CALCULATE(COUNTROWS('Qualifying'), 'Qualifying'[Qualifying Position] = 1)" });
m(q, { name: 'Avg Gap to Fastest (%)', folder: 'Qualifying', fmt: '0.00%', desc: "Mean percentage by which qualifying laps were slower than the session's fastest lap. Lower is closer to pole.", expr: "AVERAGE('Qualifying'[Gap to Fastest (%)])" });
m(q, { name: 'Reached Q3', folder: 'Qualifying', fmt: '#,##0', desc: 'Qualifying sessions in which the driver set a Q3 time (three-session format, from 2006 in this data).', expr: "CALCULATE(COUNTROWS('Qualifying'), NOT ISBLANK('Qualifying'[Q3 (ms)]))" });
m(q, { name: 'Quali Poles Rank', folder: 'Helpers', fmt: '0', hidden: true, desc: 'Rank of each driver by qualifying poles in the current selection.', expr: "IF([Quali Poles] > 0, RANKX(ALLSELECTED('Driver'[Driver]), [Quali Poles], , DESC, Skip))" });
m(q, { name: 'Quali Coverage Message', folder: 'Messages', fmt: '@', desc: 'Coverage note for qualifying visuals.', expr: R`VAR _n = COUNTROWS(FILTER(VALUES('Season'[Season]), CALCULATE(COUNTROWS('Qualifying')) > 0))
VAR _first = MINX('Qualifying', RELATED('Race'[Season Year]))
RETURN IF(COALESCE(_n, 0) = 0, "No qualifying records in these seasons. They start in 1994 and are partial in the early years.", "Qualifying records cover " & _n & " seasons in view, from " & _first & " (partial in the early years).")` });

module.exports = { 'Race Results': rr, 'Pit Stops': ps, 'Qualifying': q };
