// Calculated columns to inject (table -> list). Expressions are DAX.
const R = String.raw;
module.exports = {
  'Race': [
    { name: 'Race Laps', type: 'int64', fmt: '0', desc: "Laps completed by the winner (most laps completed by any entry). Used to place pit stops as a share of race distance.", expr: R`MAXX(RELATEDTABLE('Race Results'), 'Race Results'[Laps Completed])` }
  ],
  'Race Results': [
    { name: 'Outcome', type: 'string', sort: 'Outcome Order', desc: "How a start ended, from the position code and status group: Win, Podium, 4th to 10th, 11th or lower, Retired, Disqualified or Did not start. Position bands are positions, not points, so they are comparable across scoring systems.", expr: R`SWITCH(TRUE(), NOT 'Race Results'[Started], "Did not start", 'Race Results'[Finish Position] = 1, "Win", 'Race Results'[Finish Position] <= 3, "Podium", 'Race Results'[Finish Position] <= 10, "4th to 10th", NOT ISBLANK('Race Results'[Finish Position]), "11th or lower", 'Race Results'[Status Group] = "Disqualified", "Disqualified", "Retired")` },
    { name: 'Outcome Order', type: 'int64', hidden: true, fmt: '0', desc: 'Display order of Outcome.', expr: R`SWITCH(TRUE(), NOT 'Race Results'[Started], 7, 'Race Results'[Finish Position] = 1, 1, 'Race Results'[Finish Position] <= 3, 2, 'Race Results'[Finish Position] <= 10, 3, NOT ISBLANK('Race Results'[Finish Position]), 4, 'Race Results'[Status Group] = "Disqualified", 6, 5)` },
    { name: 'Position Change', type: 'int64', fmt: '+0;-0;0', desc: 'Grid slot minus classified finishing position for classified starts with a recorded grid of 1 or more. Positive means places gained. Blank when unclassified, pit lane or missing.', expr: R`IF('Race Results'[Started] && 'Race Results'[Grid Position] >= 1 && NOT ISBLANK('Race Results'[Finish Position]), 'Race Results'[Grid Position] - 'Race Results'[Finish Position])` },
    { name: 'Position Change (capped)', type: 'int64', fmt: '+0;-0;0', desc: 'Position Change limited to -10 and +10 so the distribution chart stays readable; the ends mean 10 or more.', expr: R`IF(ISBLANK('Race Results'[Position Change]), BLANK(), MAX(-10, MIN(10, 'Race Results'[Position Change])))` },
    { name: 'Grid Slot', type: 'int64', fmt: '0', desc: 'Starting slot 1 to 24 for starts with a recorded grid. Pit lane or unrecorded (0), missing and slots beyond 24 are blank.', expr: R`IF('Race Results'[Started] && 'Race Results'[Grid Position] >= 1 && 'Race Results'[Grid Position] <= 24, 'Race Results'[Grid Position])` }
  ],
  'Pit Stops': [
    { name: 'Pit Lane Time (s)', type: 'double', fmt: '0.0', desc: 'Time in the pit lane from entry to exit in seconds. This is not the stationary tyre-change time, which this dataset does not contain.', expr: R`DIVIDE('Pit Stops'[Pit Stop Duration (ms)], 1000)` },
    { name: 'Is Typical', type: 'boolean', desc: 'True for pit-lane times up to 60 seconds. Longer times (repairs, red flags) are reported as extended and left out of typical-time measures.', expr: R`NOT ISBLANK('Pit Stops'[Pit Stop Duration (ms)]) && 'Pit Stops'[Pit Stop Duration (ms)] <= 60000` },
    { name: 'Time Bucket', type: 'string', sort: 'Time Bucket Order', desc: 'Pit-lane time band for the distribution chart.', expr: R`SWITCH(TRUE(), ISBLANK('Pit Stops'[Pit Lane Time (s)]), BLANK(), 'Pit Stops'[Pit Lane Time (s)] < 18, "Under 18 s", 'Pit Stops'[Pit Lane Time (s)] < 20, "18-20 s", 'Pit Stops'[Pit Lane Time (s)] < 22, "20-22 s", 'Pit Stops'[Pit Lane Time (s)] < 24, "22-24 s", 'Pit Stops'[Pit Lane Time (s)] < 26, "24-26 s", 'Pit Stops'[Pit Lane Time (s)] < 30, "26-30 s", 'Pit Stops'[Pit Lane Time (s)] <= 60, "30-60 s", "Over 60 s")` },
    { name: 'Time Bucket Order', type: 'int64', hidden: true, fmt: '0', desc: 'Order of Time Bucket.', expr: R`SWITCH(TRUE(), ISBLANK('Pit Stops'[Pit Lane Time (s)]), BLANK(), 'Pit Stops'[Pit Lane Time (s)] < 18, 1, 'Pit Stops'[Pit Lane Time (s)] < 20, 2, 'Pit Stops'[Pit Lane Time (s)] < 22, 3, 'Pit Stops'[Pit Lane Time (s)] < 24, 4, 'Pit Stops'[Pit Lane Time (s)] < 26, 5, 'Pit Stops'[Pit Lane Time (s)] < 30, 6, 'Pit Stops'[Pit Lane Time (s)] <= 60, 7, 8)` },
    { name: 'Race Progress', type: 'string', sort: 'Race Progress Order', desc: "Stop lap as a share of the race distance (winner's laps), in tenths.", expr: R`VAR _laps = RELATED('Race'[Race Laps])
VAR _p = DIVIDE('Pit Stops'[Lap Number], _laps)
RETURN IF(ISBLANK(_p), BLANK(), IF(_p > 1, "Over 100%", SWITCH(TRUE(), _p <= 0.1, "0-10%", _p <= 0.2, "10-20%", _p <= 0.3, "20-30%", _p <= 0.4, "30-40%", _p <= 0.5, "40-50%", _p <= 0.6, "50-60%", _p <= 0.7, "60-70%", _p <= 0.8, "70-80%", _p <= 0.9, "80-90%", "90-100%")))` },
    { name: 'Race Progress Order', type: 'int64', hidden: true, fmt: '0', desc: 'Order of Race Progress.', expr: R`VAR _laps = RELATED('Race'[Race Laps])
VAR _p = DIVIDE('Pit Stops'[Lap Number], _laps)
RETURN IF(ISBLANK(_p), BLANK(), IF(_p > 1, 11, MIN(10, ROUNDUP(_p * 10, 0))))` },
    { name: 'Race Median (s)', type: 'double', fmt: '0.0', desc: 'Median typical pit-lane time of the same Grand Prix, for comparing one stop with its race.', expr: R`VAR _r = 'Pit Stops'[Race Id]
VAR _m = MEDIANX(FILTER('Pit Stops', 'Pit Stops'[Race Id] = _r && 'Pit Stops'[Pit Stop Duration (ms)] <= 60000), 'Pit Stops'[Pit Stop Duration (ms)])
RETURN CONVERT(_m / 1000, DOUBLE)` },
    { name: 'Gap to Race Median (s)', type: 'double', fmt: '+0.0;-0.0;0.0', desc: 'Pit-lane time minus the median typical pit-lane time of the same Grand Prix. Negative means faster than the race median; a very large negative gap can point to a data artefact.', expr: R`'Pit Stops'[Pit Lane Time (s)] - 'Pit Stops'[Race Median (s)]` }
  ],
  'Qualifying': [
    { name: 'Session Fastest (ms)', type: 'int64', fmt: '#,##0', desc: 'Fastest qualifying lap of the whole session in milliseconds.', expr: R`VAR _r = 'Qualifying'[Race Id]
RETURN MINX(FILTER('Qualifying', 'Qualifying'[Race Id] = _r), 'Qualifying'[Best Qualifying Time (ms)])` },
    { name: 'Gap to Fastest (%)', type: 'double', fmt: '0.00%', desc: "Driver's best qualifying lap as a percentage slower than the session's fastest lap. Zero for the pole sitter.", expr: R`IF(ISBLANK('Qualifying'[Best Qualifying Time (ms)]), BLANK(), DIVIDE('Qualifying'[Best Qualifying Time (ms)], 'Qualifying'[Session Fastest (ms)]) - 1)` }
  ],
  'Season': [
    { name: 'Scoring Changed', type: 'boolean', desc: 'True when the points for a win or for second place differ from the previous season, which marks a detected change of scoring system. Only these two values are compared, so changes lower down the points table are not detected.', expr: R`VAR _prev = LOOKUPVALUE('Season'[Scoring System], 'Season'[Season], 'Season'[Season] - 1)
RETURN NOT ISBLANK('Season'[Scoring System]) && NOT ISBLANK(_prev) && _prev <> 'Season'[Scoring System]` }
  ]
};
