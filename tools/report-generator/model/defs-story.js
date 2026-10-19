// Storytelling pass: page headlines, action titles and highlight colours. Added to / replacing measures in the TMDL files.
const R = String.raw;
const AMBER = '#F5B301', GREY = '#5B6470';
const rr = [], dq = [], dqc = [], raw = [], pit = [];
const m = (list, o) => list.push(o);

// ---------- page headlines (one per page, the story read in order) ----------
m(rr, { name: 'Headline Overview', folder: 'Headlines', fmt: '@', desc: 'Overview headline: how retirements, pole conversion and the top driver share of wins moved between the first and last decade in view. Falls back to the general headline or the empty-state message.', expr: R`VAR _dec = FILTER(VALUES('Season'[Decade]), [Starts] >= 100)
VAR _a = MINX(_dec, 'Season'[Decade])
VAR _b = MAXX(_dec, 'Season'[Decade])
VAR _ra = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Decade] = _a))
VAR _rb = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Decade] = _b))
VAR _pa = CALCULATE([Pole to Win Conversion], KEEPFILTERS('Season'[Decade] = _a))
VAR _pb = CALCULATE([Pole to Win Conversion], KEEPFILTERS('Season'[Decade] = _b))
VAR _ca = CALCULATE([Top Driver Share of Wins], KEEPFILTERS('Season'[Decade] = _a))
VAR _cb = CALCULATE([Top Driver Share of Wins], KEEPFILTERS('Season'[Decade] = _b))
VAR _ok = NOT HASONEVALUE('Driver'[Driver]) && _a <> _b && NOT ISBLANK(_a) && NOT ISBLANK(_ra) && NOT ISBLANK(_rb) && NOT ISBLANK(_pa) && NOT ISBLANK(_pb) && NOT ISBLANK(_ca) && NOT ISBLANK(_cb)
RETURN IF(COALESCE([Starts], 0) = 0, [Empty State Message], IF(_ok, _a & "s to " & _b & "s: retirements " & IF(_rb < _ra, "fell", "rose") & " from " & FORMAT(_ra, "0%") & " to " & FORMAT(_rb, "0%") & ", poles converted to wins " & FORMAT(_pa, "0%") & " to " & FORMAT(_pb, "0%") & ", the top driver's win share " & FORMAT(_ca, "0%") & " to " & FORMAT(_cb, "0%") & ".", "In view: " & FORMAT([# Races Held], "#,##0") & IF([# Races Held] = 1, " Grand Prix, ", " Grands Prix, ") & FORMAT([# Drivers Started], "#,##0") & IF([# Drivers Started] = 1, " driver; ", " drivers; ") & "retirements ended " & FORMAT([Retirement Rate], "0%") & " of starts" & IF(ISBLANK([Pole to Win Conversion]), "", " and a pole won " & FORMAT([Pole to Win Conversion], "0%") & " of the time") & "."))` });
m(rr, { name: 'Headline Driver', folder: 'Headlines', fmt: '@', desc: 'Driver Intelligence headline: the selected driver\'s wins, starts, win rate and rank among all drivers, or the all-time leader when no single driver is selected.', expr: R`VAR _one = HASONEVALUE('Driver'[Driver])
VAR _name = SELECTEDVALUE('Driver'[Driver])
VAR _top = TOPN(1, FILTER(VALUES('Driver'[Driver]), [Wins] > 0), [Wins], DESC)
VAR _lead = MAXX(_top, 'Driver'[Driver])
VAR _leadWins = MAXX(_top, [Wins])
VAR _w = [Wins] + 0
VAR _rank = RANKX(ALL('Driver'[Driver]), [Wins], _w, DESC, Skip)
VAR _field = CALCULATE([# Drivers Started], REMOVEFILTERS('Driver'))
RETURN IF(COALESCE([Starts], 0) = 0, [Empty State Message], IF(_one, _name & " won " & FORMAT(_w, "#,##0") & " of " & FORMAT([Starts], "#,##0") & " starts (" & FORMAT(DIVIDE(_w, [Starts]), "0%") & ") and ranks " & _rank & " of " & FORMAT(_field, "#,##0") & " drivers by wins.", _lead & " leads with " & FORMAT(_leadWins, "#,##0") & " wins in the seasons in view. Choose a driver to see their story."))` });
m(rr, { name: 'Headline Constructor', folder: 'Headlines', fmt: '@', desc: 'Constructor Analysis headline: the selected constructor\'s wins, titles and retirement rate, or the leading constructor when none is selected.', expr: R`VAR _one = HASONEVALUE('Constructor'[Constructor])
VAR _name = SELECTEDVALUE('Constructor'[Constructor])
VAR _top = TOPN(1, FILTER(VALUES('Constructor'[Constructor]), [Wins] > 0), [Wins], DESC)
VAR _lead = MAXX(_top, 'Constructor'[Constructor])
VAR _leadWins = MAXX(_top, [Wins])
VAR _t = [Constructor Titles] + 0
RETURN IF(COALESCE([Starts], 0) = 0, [Empty State Message], IF(_one, _name & " won " & FORMAT([Wins] + 0, "#,##0") & " races and " & FORMAT(_t, "#,##0") & IF(_t = 1, " constructors' title", " constructors' titles") & " from " & FORMAT([Starts], "#,##0") & " starts, ending " & FORMAT([Retirement Rate], "0%") & " of them in retirement.", _lead & " leads the constructors with " & FORMAT(_leadWins, "#,##0") & " wins in the seasons in view. Choose a constructor to see their story."))` });
m(rr, { name: 'Headline Explorer', folder: 'Headlines', fmt: '@', desc: 'Race & Circuit Explorer headline: for one chosen Grand Prix, who won and from which grid slot; otherwise how to use the page.', expr: R`VAR _winner = MAXX(FILTER('Race Results', 'Race Results'[Finish Position] = 1), RELATED('Driver'[Driver]))
VAR _team = MAXX(FILTER('Race Results', 'Race Results'[Finish Position] = 1), RELATED('Constructor'[Constructor]))
VAR _grid = MAXX(FILTER('Race Results', 'Race Results'[Finish Position] = 1), 'Race Results'[Grid Position])
RETURN IF(HASONEVALUE('Race'[Race Id]) && NOT ISBLANK(_winner), [Race View Title] & ": " & _winner & " (" & _team & ") won from " & IF(ISBLANK(_grid), "an unrecorded grid slot", IF(_grid = 0, "the pit lane", "grid slot " & _grid)) & ".", "Choose a season and a Grand Prix to see how one race unfolded. The circuit section below follows the Circuit filter.")` });
m(rr, { name: 'Headline Qualifying', folder: 'Headlines', fmt: '@', desc: 'Qualifying & Race Performance headline: how often a pole start became a win and how far the average qualifying lap was from the fastest.', expr: R`VAR _c = [Pole to Win Conversion]
VAR _g = [Avg Gap to Fastest (%)]
RETURN IF(COALESCE([Starts], 0) = 0, [Empty State Message], IF(ISBLANK(_c), "Too few poles in these seasons to say how often a pole start wins.", "From pole, " & FORMAT(_c, "0%") & " of starts ended in a win" & IF(ISBLANK(_g), ".", ", and the average qualifying lap was " & FORMAT(_g, "0.0%") & " slower than the fastest of its session.")))` });
m(rr, { name: 'Headline Pit Stops', folder: 'Headlines', fmt: '@', desc: 'Pit Stop Analysis headline: typical pit-lane time in the first and last season in view that has pit-stop records, or a note that there are none.', expr: R`VAR _all = FILTER(VALUES('Season'[Season]), CALCULATE(COUNTROWS('Pit Stops')) > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _ps = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a = MINX(_ps, 'Season'[Season])
VAR _b = MAXX(_ps, 'Season'[Season])
VAR _ta = CALCULATE([Typical Pit Time (s)], KEEPFILTERS('Season'[Season] = _a))
VAR _tb = CALCULATE([Typical Pit Time (s)], KEEPFILTERS('Season'[Season] = _b))
RETURN IF(ISBLANK(_a), "No pit-stop records in these seasons (they begin in 1994). The chart below shows how starts ended instead.", IF(_a = _b, "Typical pit-lane time in " & _a & ": " & FORMAT(_ta, "0.0") & " seconds, entry to exit.", "Typical pit-lane time " & IF(_tb < _ta, "fell", "rose") & " from " & FORMAT(_ta, "0.0") & " s in " & _a & " to " & FORMAT(_tb, "0.0") & " s in " & _b & ", entry to exit."))` });
m(rr, { name: 'Headline Eras', folder: 'Headlines', fmt: '@', desc: 'F1 Through the Eras headline (the recap): calendar length, retirement rate and scoring changes between the first and last season in view.', expr: R`VAR _all = FILTER(VALUES('Season'[Season]), [Starts] > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _s = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a = MINX(_s, 'Season'[Season])
VAR _b = MAXX(_s, 'Season'[Season])
VAR _ga = CALCULATE([# Races Held], KEEPFILTERS('Season'[Season] = _a))
VAR _gb = CALCULATE([# Races Held], KEEPFILTERS('Season'[Season] = _b))
VAR _ra = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Season] = _a))
VAR _rb = CALCULATE([Retirement Rate], KEEPFILTERS('Season'[Season] = _b))
VAR _sc = [Scoring Changes Detected]
RETURN IF(COALESCE([Starts], 0) = 0, [Empty State Message], IF(_a = _b, "Choose a wider range of seasons to compare eras.", "From " & _a & " to " & _b & " the calendar went from " & _ga & " to " & _gb & " races, retirements " & IF(_rb < _ra, "fell", "rose") & " from " & FORMAT(_ra, "0%") & " to " & FORMAT(_rb, "0%") & " of starts, and the scoring system changed " & COALESCE(_sc, 0) & IF(COALESCE(_sc, 0) = 1, " time.", " times.")))` });
m(dq, { name: 'Headline Data Quality', folder: 'Headlines', fmt: '@', desc: 'Data Quality headline: how many tables pass the integrity checks, warn or fail.', expr: R`[DQ Pass Count] & " of " & COUNTROWS(ALL('DQ Tables')) & " tables pass the integrity checks; " & [DQ Warn Count] & IF([DQ Warn Count] = 1, " warns and ", " warn and ") & [DQ Fail Count] & IF([DQ Fail Count] = 1, " fails", " fail") & ". Each is explained below."` });

// ---------- action titles carrying live numbers ----------
const LB = "SELECTEDVALUE('Leaderboard Metric'[Leaderboard Metric Order], 0)";
const CM = "SELECTEDVALUE('Constructor Metric'[Constructor Metric Order], 0)";
m(rr, { name: 'Action Leaderboard Drivers', folder: 'Action titles', fmt: '@', desc: 'Leaderboard title that names the leading driver for the chosen metric and its value.', expr: R`VAR _top = TOPN(1, FILTER(VALUES('Driver'[Driver]), [Leaderboard Value] > 0), [Leaderboard Value], DESC)
VAR _v = MAXX(_top, [Leaderboard Value])
VAR _m = SWITCH(${LB}, 0, "wins", 1, "podiums", 2, "poles", 3, "titles", 4, "points", 5, "starts")
RETURN IF(ISBLANK(_v), "Top drivers by " & _m, MAXX(_top, 'Driver'[Driver]) & " leads in " & _m & ": " & FORMAT(_v, "#,##0"))` });
m(rr, { name: 'Action Leaderboard Constructors', folder: 'Action titles', fmt: '@', desc: 'Leaderboard title that names the leading constructor for the chosen metric and its value.', expr: R`VAR _top = TOPN(1, FILTER(VALUES('Constructor'[Constructor]), [Constructor Leaderboard Value] > 0), [Constructor Leaderboard Value], DESC)
VAR _v = MAXX(_top, [Constructor Leaderboard Value])
VAR _m = SWITCH(${CM}, 0, "wins", 1, "podiums", 2, "poles", 3, "titles", 4, "points", 5, "starts")
RETURN IF(ISBLANK(_v), "Top constructors by " & _m, MAXX(_top, 'Constructor'[Constructor]) & " leads in " & _m & ": " & FORMAT(_v, "#,##0"))` });
m(rr, { name: 'Action Wins Trend', folder: 'Action titles', fmt: '@', desc: 'Title for wins per season: the season with the most wins in view.', expr: R`VAR _top = TOPN(1, FILTER(VALUES('Season'[Season]), [Wins] > 0), [Wins], DESC, 'Season'[Season], DESC)
RETURN IF(ISBLANK(MAXX(_top, [Wins])), "Wins per season", "Wins per season: the peak was " & MAXX(_top, [Wins]) & " in " & MAXX(_top, 'Season'[Season]))` });
m(rr, { name: 'Action Reliability', folder: 'Action titles', fmt: '@', desc: 'Title for reliability: mechanical-failure rate in the first and last season in view.', expr: R`VAR _all = FILTER(VALUES('Season'[Season]), [Starts] > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _s = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a = MINX(_s, 'Season'[Season])
VAR _b = MAXX(_s, 'Season'[Season])
VAR _ra = CALCULATE([Mechanical Retirement Rate], KEEPFILTERS('Season'[Season] = _a))
VAR _rb = CALCULATE([Mechanical Retirement Rate], KEEPFILTERS('Season'[Season] = _b))
RETURN IF(ISBLANK(_a) || _a = _b || ISBLANK(_ra) || ISBLANK(_rb), "Share of starts lost to mechanical failure, accidents and other retirements", "Mechanical failures ended " & FORMAT(_ra, "0%") & " of starts in " & _a & " and " & FORMAT(_rb, "0%") & " in " & _b)` });
m(rr, { name: 'Action Slot Win Rate', folder: 'Action titles', fmt: '@', desc: 'Title for win rate by starting slot: pole against fifth on the grid.', expr: R`VAR _p = CALCULATE([Win Rate (%)], 'Race Results'[Grid Slot] = 1)
VAR _f = CALCULATE([Win Rate (%)], 'Race Results'[Grid Slot] = 5)
RETURN IF(ISBLANK(_p), "Win rate by starting slot", "A start from pole wins " & FORMAT(_p, "0%") & " of the time" & IF(ISBLANK(_f), "", "; from fifth, " & FORMAT(_f, "0%")))` });
m(rr, { name: 'Action Laps Led', folder: 'Action titles', fmt: '@', desc: 'Title for laps led: the driver who led the most laps and how many.', expr: R`VAR _top = TOPN(1, FILTER(VALUES('Driver'[Driver]), [Laps Led] > 0), [Laps Led], DESC)
RETURN IF(ISBLANK(MAXX(_top, [Laps Led])), "Laps led (lap data from 1982)", MAXX(_top, 'Driver'[Driver]) & " led the most laps: " & FORMAT(MAXX(_top, [Laps Led]), "#,##0"))` });
m(rr, { name: 'Action Qualifying Gap', folder: 'Action titles', fmt: '@', desc: 'Title for the qualifying gap: average gap to the fastest lap in the first and last season with qualifying data in view.', expr: R`VAR _all = FILTER(VALUES('Season'[Season]), CALCULATE(COUNTROWS('Qualifying')) > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _s = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a = MINX(_s, 'Season'[Season])
VAR _b = MAXX(_s, 'Season'[Season])
VAR _ga = CALCULATE([Avg Gap to Fastest (%)], KEEPFILTERS('Season'[Season] = _a))
VAR _gb = CALCULATE([Avg Gap to Fastest (%)], KEEPFILTERS('Season'[Season] = _b))
RETURN IF(ISBLANK(_a) || _a = _b || ISBLANK(_ga) || ISBLANK(_gb), "Average qualifying gap to the fastest lap, by season", "The average qualifying lap was " & FORMAT(_ga, "0.0%") & " off the fastest in " & _a & " and " & FORMAT(_gb, "0.0%") & " in " & _b)` });
m(rr, { name: 'Action Stops per Car', folder: 'Action titles', fmt: '@', desc: 'Title for stops per car: the season with the most stops per car in view.', expr: R`VAR _top = TOPN(1, FILTER(VALUES('Season'[Season]), [Stops per Car] > 0), [Stops per Car], DESC, 'Season'[Season], DESC)
RETURN IF(ISBLANK(MAXX(_top, [Stops per Car])), "Pit stops per car by season", "Stops per car peaked at " & FORMAT(MAXX(_top, [Stops per Car]), "0.0") & " in " & MAXX(_top, 'Season'[Season]))` });
m(rr, { name: 'Action Calendar', folder: 'Action titles', fmt: '@', desc: 'Title for calendar growth: races in the first and last season in view.', expr: R`VAR _all = FILTER(VALUES('Season'[Season]), [Starts] > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _s = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a = MINX(_s, 'Season'[Season])
VAR _b = MAXX(_s, 'Season'[Season])
VAR _ga = CALCULATE([# Races Held], KEEPFILTERS('Season'[Season] = _a))
VAR _gb = CALCULATE([# Races Held], KEEPFILTERS('Season'[Season] = _b))
RETURN IF(ISBLANK(_a) || _a = _b, "Grands Prix per season", "The calendar went from " & _ga & " races in " & _a & " to " & _gb & " in " & _b)` });
m(rr, { name: 'Action Participation', folder: 'Action titles', fmt: '@', desc: 'Title for participation: drivers who started in the first and last season in view.', expr: R`VAR _all = FILTER(VALUES('Season'[Season]), [Starts] > 0)
VAR _cmpN = COUNTROWS(FILTER(_all, CALCULATE(MIN('Season'[Complete Flag])) = 1))
VAR _s = FILTER(_all, _cmpN = 0 || CALCULATE(MIN('Season'[Complete Flag])) = 1)
VAR _a = MINX(_s, 'Season'[Season])
VAR _b = MAXX(_s, 'Season'[Season])
VAR _da = CALCULATE([# Drivers Started], KEEPFILTERS('Season'[Season] = _a))
VAR _db = CALCULATE([# Drivers Started], KEEPFILTERS('Season'[Season] = _b))
RETURN IF(ISBLANK(_a) || _a = _b, "Drivers, teams and cars per race", "Drivers per season went from " & _da & " in " & _a & " to " & _db & " in " & _b)` });
m(rr, { name: 'Action Balance', folder: 'Action titles', fmt: '@', desc: 'Title for competitive balance: the season with the most different winners.', expr: R`VAR _top = TOPN(1, FILTER(VALUES('Season'[Season]), [# Race Winners] > 0), [# Race Winners], DESC, 'Season'[Season], DESC)
RETURN IF(ISBLANK(MAXX(_top, [# Race Winners])), "Different winners per season", "Most open season: " & MAXX(_top, 'Season'[Season]) & ", with " & MAXX(_top, [# Race Winners]) & " different winners")` });
m(rr, { name: 'Action Winner Grid', folder: 'Action titles', fmt: '@', desc: 'Title for the winner\'s grid slot: average slot and share of wins from pole.', expr: R`VAR _g = [Winner Grid Slot]
RETURN IF(ISBLANK(_g), "Winner's average grid slot by year", "Winners started from slot " & FORMAT(_g, "0.0") & " on average, " & FORMAT([Winners from Pole Share], "0%") & " of them from pole")` });

// ---------- highlight colours (grey for context, amber for the story point) ----------
const colour = (name, desc, expr) => m(rr, { name, folder: 'Highlight colours', fmt: '@', desc, expr });
colour('Color Decade Ends', 'Amber for the first and last decade in view, grey for the others, so the before and after stand out.', R`VAR _cur = MAX('Season'[Decade])
VAR _dec = FILTER(ALLSELECTED('Season'[Decade], 'Season'[Era]), CALCULATE([Starts]) >= 100)
VAR _a = MINX(_dec, 'Season'[Decade])
VAR _b = MAXX(_dec, 'Season'[Decade])
RETURN IF(_cur = _a || _cur = _b, "${AMBER}", "${GREY}")`);
colour('Color Top Driver', 'Amber for the top-ranked driver bar, grey for the rest.', `IF([Driver Leaderboard Rank] = 1, "${AMBER}", "${GREY}")`);
colour('Color Top Constructor', 'Amber for the top-ranked constructor bar, grey for the rest.', `IF([Constructor Leaderboard Rank] = 1, "${AMBER}", "${GREY}")`);
colour('Color Peak Wins Season', 'Amber for the season with the most wins in view, grey for the other seasons.', R`VAR _cur = MAX('Season'[Season])
VAR _peak = MAXX(TOPN(1, FILTER(ALLSELECTED('Season'[Season]), [Wins] > 0), [Wins], DESC, 'Season'[Season], DESC), 'Season'[Season])
RETURN IF(_cur = _peak, "${AMBER}", "${GREY}")`);
colour('Color Pole Slot', 'Amber for starting slot 1 (pole), grey for the other slots.', `IF(MAX('Race Results'[Grid Slot]) = 1, "${AMBER}", "${GREY}")`);
colour('Color Top Wins Driver', 'Amber for the driver with the most wins in view, grey for the rest.', `IF([Driver Wins Rank] = 1, "${AMBER}", "${GREY}")`);
colour('Color Top Wins Constructor', 'Amber for the constructor with the most wins in view, grey for the rest.', `IF([Constructor Wins Rank] = 1, "${AMBER}", "${GREY}")`);
colour('Color Top Laps Led', 'Amber for the driver who led the most laps, grey for the rest.', `IF([Laps Led Rank] = 1, "${AMBER}", "${GREY}")`);
colour('Color Fastest Pit Team', 'Amber for the constructor with the fastest typical pit-lane time, grey for the rest.', `IF([Constructor Pit Time Rank] = 1, "${AMBER}", "${GREY}")`);
colour('Color Gained Places', 'Amber for drivers who gained places, grey for those who lost or held position.', `IF([Positions Gained] > 0, "${AMBER}", "${GREY}")`);

// ---------- status colours: only exceptions are coloured; text always says Pass, Warn or Fail ----------
const stat = (list, name, status) => m(list, { name, folder: 'Data quality', fmt: '@', desc: 'Text colour for the status: grey for Pass, amber for Warn, white for Fail. The word Pass, Warn or Fail is always shown, so colour is never the only cue.', expr: `SWITCH(${status}, "Pass", "#7B8494", "Warn", "${AMBER}", "Fail", "#FFFFFF", "#F2F2F2")` });
stat(dq, 'DQ Table Status Ink', '[DQ Status]');
stat(raw, 'DQ Profile Status Ink', '[DQ Profile Status]');
stat(dqc, 'DQ Missing Status Ink', '[DQ Missing Status]');
stat(rr, 'Standings Gap Status Ink', '[Standings Gap Status]');

module.exports = { 'Race Results': rr, 'DQ Tables': dq, 'DQ Columns': dqc, 'DQ Raw Profile': raw };
