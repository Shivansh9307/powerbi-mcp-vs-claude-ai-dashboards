// Pages 4-8: Race & Circuit Explorer, Qualifying & Race Performance, Pit Stop Analysis, F1 Through the Eras, Data Quality & Coverage.
const L = require('./f1-lib.js');
const { C, X0, CW, BODY_Y, card, textbox, chart, table, matrix, scatter, slicer, shell, newPage, measureFilter, winnersFilter, colRangeFilter, colFilter, rectShape, str, bool, num, int, fill, measRef, colRef } = L;
const RR = 'Race Results';
const ALLCHARTS = ['barChart', 'columnChart', 'clusteredColumnChart', 'clusteredBarChart', 'lineChart', 'tableEx', 'pivotTable', 'scatterChart', 'hundredPercentStackedColumnChart', 'lineClusteredColumnComboChart'];
const noFilterFrom = (p, labels) => {
  const src = p.visuals.filter((v) => labels.includes(v.label));
  const tgt = p.visuals.filter((v) => ALLCHARTS.includes(v.json.visual.visualType));
  for (const s of src) for (const t of tgt) if (t !== s) p.interactions.push({ source: s.json.name, target: t.json.name, type: 'NoFilter' });
};
const msgCard = (p, label, y, m, color = C.muted, size = 13, x = X0, w = CW, h = 28) => card(p, label, x, y, w, h, { m: [m], showLabel: false, fillColor: null, color: null, accent: 'none', size, textColor: color, padding: 2, alt: `${m[1]}: a note generated from the data` });
const note = (p, label, x, y, w, h, title, body, color = C.text) => textbox(p, label, x, y, w, h, [{ t: title, size: 14, font: 'Segoe UI Semibold', color }, ...body.map((t) => ({ t, size: 13, color: C.muted }))], `${title}. ${body.join(' ')}`, { padLeft: 4, padRight: 12, padTop: 6, padBottom: 6 });

// heat cell background (0 to 1 coverage) and status font colours
const heat = (queryRef, entity, measure, lo = '#1D2128', hi = '#8A6508') => ({
  properties: { backColor: { solid: { color: { expr: { FillRule: { Input: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: measure } }, FillRule: { linearGradient2: { min: { color: { Literal: { Value: `'${lo}'` } }, value: { Literal: { Value: '0D' } } }, max: { color: { Literal: { Value: `'${hi}'` } }, value: { Literal: { Value: '1D' } } }, nullColoringStrategy: { strategy: { Literal: { Value: "'noColor'" } } } } } } } } } } },
  selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: queryRef }
});
const statusColour = (queryRef, entity, measure) => ({
  properties: { fontColor: { solid: { color: { expr: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: measure } } } } } },
  selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: queryRef }
});
const withValues = (cells) => ({ values: [{ properties: { fontSize: num(10), fontColorPrimary: fill(C.text), fontColorSecondary: fill(C.text), backColorPrimary: fill(C.surface), backColorSecondary: fill(C.surfaceAlt) } }, ...cells] });

// =====================================================================
// 4. Race & Circuit Explorer (tall page, scrolls)
// =====================================================================
const explorerHeight = 1800;
function explorer() {
  const p = newPage('explorer');
  shell(p, { title: 'Race & Circuit Explorer', headline: 'Headline Explorer', back: true });
  const y0 = BODY_Y;
  slicer(p, 'season_single', X0, y0, 210, 76, { entity: 'Season', prop: 'Season', header: 'Season (race view)', mode: 'Dropdown', selectAll: false, singleSelect: true, strict: false, filter: L.tf('explorer', 'season_single', 'Season', 'Season'), alt: 'Choose one season to see its races. Right-click a season elsewhere and drill through to land here.' });
  slicer(p, 'grand_prix', X0 + 222, y0, 360, 76, { entity: 'Race', prop: 'Race', header: 'Grand Prix', mode: 'Dropdown', selectAll: false, singleSelect: true, strict: false, filter: L.tf('explorer', 'gp', 'Race', 'Race'), alt: 'Choose one Grand Prix of the selected season' });
  card(p, 'race_title', X0 + 594, y0 + 8, CW - 594, 60, { m: [[RR, 'Race View Title']], showLabel: false, size: 20, padding: 4, alt: 'The Grand Prix and season shown below' });
  const r1 = y0 + 88, h1 = 360;
  table(p, 'classification', X0, r1, 800, h1, {
    cols: [['c', RR, 'Classification Order', { displayName: 'Order' }], ['m', RR, 'Result Label', { displayName: 'Result' }], ['c', 'Driver', 'Driver'], ['c', 'Constructor', 'Constructor'], ['m', RR, 'Grid Slot Label', { displayName: 'Grid' }], ['c', RR, 'Laps Completed', { displayName: 'Laps' }], ['c', 'Finishing Status', 'Status'], ['m', RR, 'Driver Points', { displayName: 'Points' }]],
    sort: ['c', RR, 'Classification Order', 'Ascending'], left: [`${RR}.Classification Order`, `${RR}.Laps Completed`], title: 'Full classification', fontSize: 10, filters: [measureFilter(RR, 'Race Selected Flag', 2, 1)],
    alt: 'Classification of the chosen Grand Prix: order, result, driver, constructor, starting slot, laps, finishing status and points. Pit lane or unrecorded starts are labelled; missing grids say Not recorded.'
  });
  scatter(p, 'grid_finish', X0 + 812, r1, 380, h1, { cat: ['Driver', 'Driver'], xm: [RR, 'Average Grid'], ym: [RR, 'Average Finish'], title: 'Grid slot vs finishing position', xTitle: 'Grid slot', yTitle: 'Finish', filters: [measureFilter(RR, 'Race Selected Flag', 2, 1)], alt: 'Scatter of starting slot against classified finishing position, one dot per driver in the chosen race.' });
  chart(p, 'positions_gained', X0 + 1204, r1, CW - 1204, h1, { type: 'barChart', cat: ['c', 'Driver', 'Driver'], y: [[RR, 'Positions Gained']], colorMeasure: [RR, 'Color Gained Places'], sort: ['m', RR, 'Positions Gained'], title: 'Places gained from the grid (negative = lost)', catLabelSize: 10, innerPadding: 8, filters: [measureFilter(RR, 'Race Selected Flag', 2, 1)], alt: 'Bar chart of places gained or lost from the starting slot to the classified finish, by driver. Unclassified and pit-lane starts are left out.' });
  const r2 = r1 + h1 + 14, h2 = 300, w3 = (CW - 24) / 3;
  table(p, 'standings_drivers', X0, r2, w3, h2, { cols: [['m', 'Driver Standings', 'Latest Driver Position', { displayName: 'Pos' }], ['c', 'Driver', 'Driver'], ['m', 'Driver Standings', 'Latest Driver Points', { displayName: 'Points' }]], sort: ['m', 'Driver Standings', 'Latest Driver Position', 'Ascending'], title: "Drivers' standings after this round", fontSize: 10, filters: [measureFilter(RR, 'Race Selected Flag', 2, 1)], alt: "Drivers' championship standings after the last race in view." });
  table(p, 'standings_constructors', X0 + w3 + 12, r2, w3, h2, { cols: [['m', 'Constructor Standings', 'Latest Constructor Position', { displayName: 'Pos' }], ['c', 'Constructor', 'Constructor'], ['m', 'Constructor Standings', 'Latest Constructor Points', { displayName: 'Points' }]], sort: ['m', 'Constructor Standings', 'Latest Constructor Position', 'Ascending'], title: "Constructors' standings after this round (from 1958)", fontSize: 10, filters: [measureFilter(RR, 'Race Selected Flag', 2, 1)], alt: "Constructors' championship standings after the last race in view. Empty before 1958." });
  table(p, 'sprint', X0 + 2 * (w3 + 12), r2, w3, h2, { cols: [['c', 'Sprint Results', 'Classification Order', { displayName: 'Order' }], ['c', 'Driver', 'Driver'], ['c', 'Constructor', 'Constructor'], ['c', 'Sprint Results', 'Grid Position', { displayName: 'Grid' }], ['m', 'Sprint Results', 'Sprint Points', { displayName: 'Points' }]], sort: ['c', 'Sprint Results', 'Classification Order', 'Ascending'], title: { m: ['Sprint Results', 'Sprint Title'] }, fontSize: 10, filters: [measureFilter(RR, 'Race Selected Flag', 2, 1)], alt: 'Sprint result of the chosen Grand Prix, when the weekend had a sprint. Sprints exist from 2021.' });
  // circuit band
  const cy = r2 + h2 + 20;
  textbox(p, 'circuit_heading', X0, cy, 900, 40, [{ t: 'Circuit explorer: pick a circuit in the Circuit filter above', size: 22, font: 'Segoe UI Semibold' }], 'Circuit explorer heading');
  const c1 = cy + 48, ch1 = 340;
  table(p, 'circuit_directory', X0, c1, 780, ch1, { cols: [['c', 'Circuit', 'Circuit'], ['c', 'Circuit', 'Country'], ['m', 'Race', '# Races Held', { displayName: 'Races' }], ['m', RR, 'First Season', { displayName: 'First' }], ['m', RR, 'Last Season', { displayName: 'Last' }]], sort: ['m', 'Race', '# Races Held', 'Descending'], left: ['Circuit.Circuit'], filters: [measureFilter('Race', '# Races Held', 2, 1)], title: 'Circuit directory', fontSize: 10, alt: 'Directory of circuits in the selection with country, races held and first and last season.' });
  chart(p, 'circuit_winners_drivers', X0 + 792, c1, 400, ch1, { type: 'barChart', cat: ['c', 'Driver', 'Driver'], y: [[RR, 'Wins']], colorMeasure: [RR, 'Color Top Wins Driver'], innerPadding: 10, sort: ['m', RR, 'Wins'], title: 'Winners by driver (top 10)', filters: [measureFilter(RR, 'Driver Wins Rank', 4, 10)], alt: 'Bar chart of the drivers with most wins at the circuits in view.' });
  chart(p, 'circuit_winners_teams', X0 + 1204, c1, CW - 1204, ch1, { type: 'barChart', cat: ['c', 'Constructor', 'Constructor'], y: [[RR, 'Wins']], colorMeasure: [RR, 'Color Top Wins Constructor'], innerPadding: 10, sort: ['m', RR, 'Wins'], title: 'Winners by constructor (top 10)', filters: [measureFilter(RR, 'Constructor Wins Rank', 4, 10)], alt: 'Bar chart of the constructors with most wins at the circuits in view.' });
  const c2 = c1 + ch1 + 14, ch2 = 340;
  chart(p, 'winner_grid_by_year', X0, c2, 520, ch2, { type: 'columnChart', cat: ['c', 'Season', 'Season'], y: [[RR, 'Winner Grid Slot']], color: C.light, scalar: false, title: { m: [RR, 'Action Winner Grid'] }, labels: false, valueAxisShow: true, alt: "Column chart by season of the average starting slot of the winner at the circuits in view. Winners starting from the pit lane or with no recorded grid are left out." });
  chart(p, 'retirement_by_year', X0 + 532, c2, 520, ch2, { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, 'Retirement Rate']], colors: [[RR, 'Retirement Rate', C.amber]], title: 'Retirement rate by year', labels: false, valueAxisShow: true, alt: 'Line chart by season of the share of starts that ended in retirement at the circuits in view.' });
  table(p, 'circuit_races', X0 + 1064, c2, CW - 1064, ch2, { cols: [['c', 'Race', 'Race Date'], ['c', 'Race', 'Race'], ['c', 'Driver', 'Driver'], ['c', 'Constructor', 'Constructor'], ['m', RR, 'Grid Slot Label', { displayName: 'Grid' }]], sort: ['c', 'Race', 'Race Date', 'Descending'], left: ['Race.Race Date'], filters: [winnersFilter()], title: 'Races at this circuit: winners', fontSize: 10, alt: 'Table of the Grands Prix at the circuits in view with the winner, the winning constructor and the winner starting slot.' });
  noFilterFrom(p, ['classification', 'standings_drivers', 'standings_constructors', 'sprint', 'circuit_directory', 'circuit_races']);
  return p;
}

// =====================================================================
// 5. Qualifying & Race Performance
// =====================================================================
function quali() {
  const p = newPage('quali');
  shell(p, { title: 'Qualifying & Race Performance', headline: 'Headline Qualifying' });
  const y0 = BODY_Y, h = 280;
  const slotFilter = () => [colRangeFilter(RR, 'Grid Slot', 1, 24)];
  chart(p, 'win_rate_by_slot', X0, y0, 520, h, { type: 'columnChart', cat: ['c', RR, 'Grid Slot'], y: [[RR, 'Win Rate (%)']], colorMeasure: [RR, 'Color Pole Slot'], title: { m: [RR, 'Action Slot Win Rate'] }, filters: slotFilter(), labels: false, valueAxisShow: true, labelPrec: 0, alt: 'Column chart of the share of starts that ended in a win for each grid slot from 1 to 24. Pit-lane and missing grids are left out.' });
  chart(p, 'slot_outcomes', X0 + 532, y0, 560, h, { type: 'hundredPercentStackedColumnChart', cat: ['c', RR, 'Grid Slot'], series: [RR, 'Outcome'], y: [[RR, 'Starts']], title: 'What happens from each slot (amber = win)', filters: slotFilter(), labels: false, legend: true, valueAxisShow: true, legendPos: 'Bottom', alt: 'Stacked columns showing, for each starting slot, the share of starts that ended in a win, podium, 4th to 10th, 11th or lower, retirement or disqualification.' });
  chart(p, 'pole_to_win', X0 + 1104, y0, CW - 1104, h, { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, 'Pole to Win Conversion']], colors: [[RR, 'Pole to Win Conversion', C.amber]], title: 'Poles that became wins, by season', labels: false, valueAxisShow: true, alt: 'Line chart by season of the share of pole positions that were converted into wins.' });
  const r2 = y0 + h + 12;
  chart(p, 'position_change', X0, r2, 480, h, { type: 'columnChart', cat: ['c', RR, 'Position Change (capped)'], y: [[RR, 'Position Change Count']], color: C.light, title: 'Places gained or lost from the grid (capped at 10)', labels: false, valueAxisShow: true, alt: 'Column chart of how many classified starts gained or lost each number of places from the grid. The end columns mean 10 or more.' });
  chart(p, 'laps_led', X0 + 492, r2, 480, h, { type: 'barChart', cat: ['c', 'Driver', 'Driver'], y: [[RR, 'Laps Led']], colorMeasure: [RR, 'Color Top Laps Led'], innerPadding: 8, sort: ['m', RR, 'Laps Led'], title: { m: [RR, 'Action Laps Led'] }, filters: [measureFilter(RR, 'Laps Led Rank', 4, 8)], alt: 'Bar chart of the drivers who led the most laps, from the lap-by-lap record.' });
  table(p, 'quali_records', X0 + 984, r2, CW - 984, h, { cols: [['c', 'Driver', 'Driver'], ['m', 'Qualifying', 'Quali Poles', { displayName: 'Poles' }], ['m', 'Qualifying', 'Avg Gap to Fastest (%)', { displayName: 'Avg gap' }], ['m', 'Qualifying', 'Reached Q3', { displayName: 'Q3s' }], ['m', 'Qualifying', 'Qualifying Entries', { displayName: 'Sessions' }]], sort: ['m', 'Qualifying', 'Quali Poles', 'Descending'], filters: [measureFilter('Qualifying', 'Quali Poles Rank', 4, 15)], left: ['Driver.Driver'], title: 'Qualifying records (top 15 by poles)', fontSize: 10, alt: 'Table of the drivers with most qualifying poles, their average gap to the fastest lap of the session, and the number of Q3 appearances.' });
  const r3 = r2 + h + 12;
  msgCard(p, 'lap_coverage', r3, [RR, 'Lap Coverage Message'], C.muted, 13, X0, 800, 24);
  msgCard(p, 'quali_coverage', r3, ['Qualifying', 'Quali Coverage Message'], C.muted, 13, X0 + 812, CW - 812, 24);
  chart(p, 'race_pace', X0, r3 + 28, 800, 1058 - (r3 + 28), { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, 'Median Lap (s)']], colors: [[RR, 'Median Lap (s)', C.light]], title: 'Race pace: median lap of the field, by season (lap data only)', labels: false, valueAxisShow: true, alt: 'Line chart by season of the median lap time over all recorded laps. Only seasons with lap data are shown. The circuits visited change, so read the trend, not exact values.' });
  chart(p, 'quali_gap', X0 + 812, r3 + 28, CW - 812, 1058 - (r3 + 28), { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [['Qualifying', 'Avg Gap to Fastest (%)']], colors: [['Qualifying', 'Avg Gap to Fastest (%)', C.light]], title: { m: [RR, 'Action Qualifying Gap'] }, labels: false, valueAxisShow: true, labelPrec: 1, alt: 'Line chart by season of how much slower the average qualifying lap was than the fastest of the session. Lower means a tighter field.' });
  noFilterFrom(p, ['quali_records']);
  return p;
}

// =====================================================================
// 6. Pit Stop Analysis
// =====================================================================
function pits() {
  const p = newPage('pits');
  shell(p, { title: 'Pit Stop Analysis', headline: 'Headline Pit Stops' });
  const y0 = BODY_Y;
  msgCard(p, 'pit_scope', y0, ['Pit Stops', 'Pit Scope Message'], C.muted, 13, X0, CW, 28);
  const r1 = y0 + 38, h = 276;
  chart(p, 'typical_pit_time', X0, r1, 520, h, { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [['Pit Stops', 'Typical Pit Time (s)']], colors: [['Pit Stops', 'Typical Pit Time (s)', C.amber]], title: 'Typical pit-lane time by season (seconds, entry to exit)', labels: false, valueAxisShow: true, labelPrec: 1, alt: 'Line chart by season of the median time cars spent in the pit lane, entry to exit, in seconds. This is not the stationary tyre-change time.' });
  chart(p, 'stops_per_car', X0 + 532, r1, 520, h, { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [['Pit Stops', 'Stops per Car']], colors: [['Pit Stops', 'Stops per Car', C.light]], title: { m: [RR, 'Action Stops per Car'] }, labels: false, valueAxisShow: true, labelPrec: 1, alt: 'Line chart by season of pit stops per car that started, counted only in races with pit-stop records.' });
  chart(p, 'time_distribution', X0 + 1064, r1, CW - 1064, h, { type: 'columnChart', cat: ['c', 'Pit Stops', 'Time Bucket'], y: [['Pit Stops', '# Pit Stops']], color: C.light, title: 'How long stops take in the pit lane', labels: true, filters: [L.notBlankFilter('Pit Stops', 'Time Bucket')], alt: 'Column chart of the number of pit stops in each pit-lane time band.' });
  const r2 = r1 + h + 12;
  chart(p, 'when_stops', X0, r2, 640, h, { type: 'columnChart', cat: ['c', 'Pit Stops', 'Race Progress'], y: [['Pit Stops', '# Pit Stops']], color: C.light, title: 'When in the race stops happen (share of race distance)', labels: false, valueAxisShow: true, innerPadding: 8, alt: 'Column chart of pit stops by share of race distance completed, in tenths.' });
  chart(p, 'pit_by_constructor', X0 + 652, r2, 400, h, { type: 'barChart', cat: ['c', 'Constructor', 'Constructor'], y: [['Pit Stops', 'Typical Pit Time (s)']], colorMeasure: [RR, 'Color Fastest Pit Team'], sort: ['m', 'Pit Stops', 'Typical Pit Time (s)', 'Ascending'], title: 'Pit-lane time by team (fastest 6, 30+ stops)', filters: [measureFilter('Pit Stops', 'Constructor Pit Time Rank', 2, 1), measureFilter('Pit Stops', 'Constructor Pit Time Rank', 4, 6)], labelPrec: 1, innerPadding: 8, alt: 'Bar chart of typical pit-lane time by constructor for teams with at least 30 stops, fastest first.' });
  table(p, 'fastest_stops', X0 + 1068, r2, CW - 1068, h, { cols: [['c', 'Race', 'Race Date'], ['c', 'Driver', 'Driver'], ['c', 'Constructor', 'Constructor'], ['c', 'Pit Stops', 'Pit Lane Time (s)', { displayName: 'Time (s)' }], ['c', 'Pit Stops', 'Gap to Race Median (s)', { displayName: 'vs race median' }]], sort: ['c', 'Pit Stops', 'Pit Lane Time (s)', 'Ascending'], left: ['Race.Race Date'], filters: [L.notBlankFilter('Pit Stops', 'Pit Lane Time (s)')], title: 'Fastest recorded pit-lane times and gap to the race median', fontSize: 10, alt: 'Table of the fastest recorded pit-lane times with each value compared with the median of its race. Very large negative gaps can point to data artefacts.' });
  const r3 = r2 + h + 12;
  chart(p, 'how_starts_ended', X0, r3, 800, 1058 - r3, { type: 'barChart', cat: ['c', 'Status Group', 'Status Group'], y: [[RR, 'Starts']], color: C.light, sort: ['c', 'Status Group', 'Status Group', 'Ascending'], title: 'How starts ended (also the fallback for seasons without pit data)', alt: 'Bar chart of starts by how they ended: finished, lapped, mechanical, accident or other retirement, disqualified. Useful for seasons with no pit-stop records.' });
  note(p, 'pit_notes', X0 + 812, r3, CW - 812, 1058 - r3, 'Read this page carefully', ['Pit-stop time here is the time from pit-lane entry to exit, normally 15 to 30 seconds. It is not the stationary time spent changing tyres, which this dataset does not contain.', 'Stops over 60 seconds are counted as extended and kept out of the typical time.', 'Pit stops are recorded from 1994. Differences between teams or seasons are not proof of cause.']);
  noFilterFrom(p, ['fastest_stops']);
  return p;
}

// =====================================================================
// 7. F1 Through the Eras
// =====================================================================
function eras() {
  const p = newPage('eras');
  shell(p, { title: 'F1 Through the Eras', headline: 'Headline Eras' });
  const y0 = BODY_Y;
  note(p, 'read_first', X0, y0, CW, 66, 'Read this before comparing eras', ['Scoring systems, calendar length and reliability changed over time, so raw totals are not comparable. Compare rates and era-normalised points instead; eras here are plain calendar decades.'], C.text);
  const r1 = y0 + 76, h = 252;
  chart(p, 'calendar_growth', X0, r1, 520, h, { type: 'columnChart', cat: ['c', 'Season', 'Season'], y: [['Race', '# Races Held']], color: C.light, title: { m: [RR, 'Action Calendar'] }, labels: false, valueAxisShow: true, alt: 'Column chart of the number of Grands Prix run in each season.' });
  chart(p, 'participation', X0 + 532, r1, 520, h, { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, '# Drivers Started', { displayName: 'Drivers' }], [RR, '# Constructors Started', { displayName: 'Constructors' }], [RR, 'Cars per Race', { displayName: 'Cars per race' }]], colors: [[RR, '# Drivers Started', C.amber], [RR, '# Constructors Started', C.text2], [RR, 'Cars per Race', C.ctx]], title: { m: [RR, 'Action Participation'] }, legend: true, labels: false, valueAxisShow: true, alt: 'Lines by season of the number of drivers who started, the number of constructors, and the average cars on the grid per race.' });
  table(p, 'scoring_systems', X0 + 1064, r1, CW - 1064, h, { cols: [['c', 'Season', 'Season'], ['c', 'Season', 'Scoring System']], sort: ['c', 'Season', 'Season', 'Descending'], left: ['Season.Season'], filters: [colFilter('Season', 'Scoring Changed', [true]), measureFilter(RR, 'Starts', 2, 1)], title: 'Scoring systems in the data: seasons where it changed', fontSize: 10, alt: 'Table of the seasons in which the points for a win or for second place differ from the previous season, which marks a detected change of scoring system.' });
  const r2 = r1 + h + 12;
  table(p, 'decade_summary', X0, r2, 820, h, { cols: [['c', 'Season', 'Era'], ['m', 'Race', '# Races Held', { displayName: 'Races' }], ['m', RR, 'Top Driver Share of Wins', { displayName: 'Top driver share' }], ['m', RR, 'Retirement Rate', { displayName: 'Retired' }], ['m', RR, 'Pole to Win Conversion', { displayName: 'Pole to win' }], ['m', RR, 'Classified Finish Rate', { displayName: 'Classified' }], ['m', RR, 'Top Scorer Era-Normalised', { displayName: 'Best era-norm. pts' }]], sort: ['c', 'Season', 'Era', 'Ascending'], left: ['Season.Era'], title: 'Decade summary', fontSize: 10, alt: 'Table by decade of races, the top driver share of wins, retirement rate, pole to win conversion, classified-finish rate and the best era-normalised points share among drivers with at least 30 starts.' });
  chart(p, 'retirement_causes', X0 + 832, r2, CW - 832, h, { type: 'columnChart', cat: ['c', 'Season', 'Era'], y: [[RR, 'Mechanical Retirement Rate'], [RR, 'Accident Retirement Rate'], [RR, 'Other Retirement Rate']], colors: [[RR, 'Mechanical Retirement Rate', C.amber], [RR, 'Accident Retirement Rate', C.text2], [RR, 'Other Retirement Rate', C.ctx]], title: 'Retirement causes per start, by decade (mechanical in amber)', legend: true, labels: false, valueAxisShow: true, alt: 'Stacked columns by decade of the share of starts lost to mechanical failure, accidents and other retirements.' });
  const r3 = r2 + h + 12, h3 = 1058 - r3;
  chart(p, 'competitive_balance', X0, r3, 520, h3, { type: 'columnChart', cat: ['c', 'Season', 'Season'], y: [[RR, 'Season Winners Distinct']], color: C.light, title: { m: [RR, 'Action Balance'] }, labels: false, valueAxisShow: true, innerPadding: 6, alt: 'Columns by season of how many different drivers won a race.' });
  chart(p, 'dominance', X0 + 532, r3, 520, h3, { type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, 'Season Dominance (top driver)']], colors: [[RR, 'Season Dominance (top driver)', C.amber]], title: 'Dominance of the top driver: win share times points share', labels: false, valueAxisShow: true, alt: 'Line by season of the dominance index of the most dominant driver: win share multiplied by points share. It shares the seasons of the chart above.' });
  const hn = Math.round((h3 - 8) / 2);
  note(p, 'seen_in_dataset', X0 + 1064, r3, CW - 1064, hn, 'Seen in the dataset', ['Results, grids, status and points for every Grand Prix; standings; qualifying from 1994, lap times from 1982, pit stops from 1994.']);
  note(p, 'external_context', X0 + 1064, r3 + hn + 8, CW - 1064, hn, 'External context (not in the dataset)', ['Regulations, engines, tyres, safety and budgets help explain these trends but are not measured here. Treat any link as background, not proof.']);
  noFilterFrom(p, ['scoring_systems']);
  return p;
}

// =====================================================================
// 8. Data Quality & Coverage (tall page)
// =====================================================================
const qualityHeight = 1700;
function quality() {
  const p = newPage('quality');
  shell(p, { title: 'Data Quality & Coverage', headline: 'Headline Data Quality', filters: false });
  const y0 = 122;
  card(p, 'dq_pass', X0, y0, 200, 64, { m: [['DQ Tables', 'DQ Pass Count']], labelText: 'Tables passing', color: C.green, size: 24, alt: 'Number of tables whose integrity checks pass', display: 'none' });
  card(p, 'dq_warn', X0 + 212, y0, 200, 64, { m: [['DQ Tables', 'DQ Warn Count']], labelText: 'Tables with warnings', color: C.amber, size: 24, alt: 'Number of tables with a warning, for example duplicate keys', display: 'none' });
  card(p, 'dq_fail', X0 + 424, y0, 200, 64, { m: [['DQ Tables', 'DQ Fail Count']], labelText: 'Tables failing', color: C.red, size: 24, alt: 'Number of tables that fail, for example keys with no match', display: 'none' });
  note(p, 'dq_legend', X0 + 636, y0, CW - 636, 80, 'How to read the checks', ['Pass: nothing to flag. Warn: explained by the data (shared drives, removed duplicate laps, coverage gaps). Fail: a real defect, such as a key with no matching row. Every figure is computed from the model or the raw files.']);
  const r1 = y0 + 92, h1 = 320;
  table(p, 'dq_tables', X0, r1, 860, h1, { cols: [['c', 'DQ Tables', 'Check Table', { displayName: 'Table' }], ['m', 'DQ Tables', 'DQ Rows', { displayName: 'Rows' }], ['m', 'DQ Tables', 'DQ First Season', { displayName: 'First season' }], ['m', 'DQ Tables', 'DQ Last Season', { displayName: 'Last season' }], ['m', 'DQ Tables', 'DQ Duplicate Keys', { displayName: 'Duplicate keys' }], ['m', 'DQ Tables', 'DQ Unmatched Keys', { displayName: 'Unmatched keys' }], ['m', 'DQ Tables', 'DQ Status', { displayName: 'Status' }]], sort: ['c', 'DQ Tables', 'Check Table', 'Ascending'], left: ['DQ Tables.Check Table'], title: 'Loaded tables: rows, span and key checks', fontSize: 10, alt: 'Table of every table in the model with its row count, first and last season, duplicate keys, keys with no match and a Pass, Warn or Fail status.' });
  table(p, 'dq_raw', X0 + 872, r1, CW - 872, h1, { cols: [['c', 'DQ Raw Profile', 'Source File', { displayName: 'Raw file' }], ['c', 'DQ Raw Profile', 'Raw Rows', { displayName: 'Raw rows' }], ['m', 'DQ Raw Profile', 'DQ Loaded Rows', { displayName: 'Loaded' }], ['m', 'DQ Raw Profile', 'DQ Rows Removed', { displayName: 'Removed' }], ['c', 'DQ Raw Profile', 'Duplicate Key Rows', { displayName: 'Dup. keys' }], ['c', 'DQ Raw Profile', 'Null Marker Cells', { displayName: 'Null cells' }], ['m', 'DQ Raw Profile', 'DQ Profile Status', { displayName: 'Status' }]], left: ['DQ Raw Profile.Source File'], title: 'Raw files vs what was loaded', fontSize: 10, alt: 'Table of each raw CSV file with its row count, rows loaded into the model, rows removed as duplicates, duplicate key rows and null-marker cells.' });
  const r2 = r1 + h1 + 12, h2 = 430;
  const covMeasures = [['Coverage Results', 'Results'], ['Coverage Sprint', 'Sprints'], ['Coverage Qualifying', 'Qualifying'], ['Coverage Laps', 'Laps'], ['Coverage Pit Stops', 'Pit stops'], ['Coverage Driver Standings', 'Driver standings'], ['Coverage Constructor Standings', 'Constructor standings'], ['Coverage Constructor Results', 'Constructor results']];
  matrix(p, 'coverage_matrix', X0, r2, 1000, h2, { rows: [['c', 'Season', 'Season']], values: covMeasures.map(([m, d]) => ['m', RR, m, { displayName: d }]), title: 'Coverage heat map: share of scheduled races with rows (darker = fewer)', extraObjects: { values: [{ properties: { fontSize: num(10), fontColorPrimary: fill(C.text), fontColorSecondary: fill(C.text), backColorPrimary: fill(C.page), backColorSecondary: fill(C.page) } }, ...covMeasures.map(([m]) => heat(`${RR}.${m}`, RR, m))] }, alt: 'Heat map with one row per season and one column per table, coloured by the share of that season scheduled races that have rows in the table. Bright amber is full coverage, dark is none.' });
  table(p, 'dq_missing', X0 + 1012, r2, CW - 1012, h2, { cols: [['c', 'DQ Columns', 'Check Column', { displayName: 'Column' }], ['m', 'DQ Columns', 'DQ Missing Cells', { displayName: 'Blank' }], ['m', 'DQ Columns', 'DQ Missing Share', { displayName: 'Share' }], ['m', 'DQ Columns', 'DQ Missing Status', { displayName: 'Status' }]], sort: ['c', 'DQ Columns', 'Check Column', 'Ascending'], left: ['DQ Columns.Check Column'], title: 'Missing values by column (blank, never zero)', fontSize: 10, alt: 'Table of key columns with the number and share of blank values. The source marks missing values as \\N and they load as blank.' });
  const r3 = r2 + h2 + 12, h3 = 330;
  table(p, 'standings_check', X0, r3, 600, h3, { cols: [['c', 'Season', 'Season'], ['m', RR, 'Official Points Total', { displayName: 'Official' }], ['m', RR, 'Recorded Points All Drivers', { displayName: 'Recorded' }], ['m', RR, 'Standings Gap', { displayName: 'Gap' }], ['m', RR, 'Standings Gap Status', { displayName: 'Status' }]], sort: ['c', 'Season', 'Season', 'Descending'], left: ['Season.Season'], title: 'Official standings vs points recorded in results', fontSize: 10, filters: [measureFilter('Race', '# Races Held', 2, 1)], alt: 'Table by season of the sum of official final standings points against the sum of race and sprint points recorded. Differences are expected where early championships counted only each driver best results.' });
  table(p, 'status_lookup', X0 + 612, r3, 560, h3, { cols: [['c', 'Status Group', 'Status Group', { displayName: 'Group' }], ['c', 'Status Group', 'Rule'], ['m', RR, 'Starts', { displayName: 'Starts' }], ['m', RR, 'Race Entries', { displayName: 'Entries' }]], sort: ['c', 'Status Group', 'Status Group', 'Ascending'], left: ['Status Group.Status Group', 'Status Group.Rule'], title: 'Status groups used', fontSize: 10, alt: 'Lookup of the seven status groups with the rule for each and the number of entries and starts in the model.' });
  table(p, 'constructor_identity', X0 + 1184, r3, CW - 1184, h3, { cols: [['c', 'Constructor Families', 'Family'], ['c', 'Constructor Families', 'Names']], title: 'Constructor identity: possible renames (not merged)', fontSize: 10, alt: 'Constructors whose names share a first word. The source has no lineage field, so each name is treated as a separate constructor.' });
  const r4 = r3 + h3 + 12, h4 = 1690 - r4;
  table(p, 'partial_seasons', X0, r4, 780, h4, { cols: [['c', 'Season', 'Season'], ['c', 'Season', 'Season Status'], ['c', 'Season', 'Races With Results'], ['c', 'Season', 'Races Scheduled']], sort: ['c', 'Season', 'Season', 'Descending'], left: ['Season.Season', 'Season.Season Status'], filters: [colFilter('Season', 'Is Complete', [false])], title: 'Partial-season flag: seasons still in progress', fontSize: 10, alt: 'Table of seasons whose calendar is not fully run, with races run and races scheduled. These seasons are included in counts and award no title.' });
  note(p, 'dq_notes', X0 + 792, r4, CW - 792, h4, 'Limits and treatments', ['Constructor renames are not merged because the source has no lineage field.', 'Lap duplicates are removed in Power Query and the count is shown above.', 'A missing value stays blank. A grid of 0 means pit lane or unrecorded and is never counted as a pole.', 'Coverage is verified from the data: laps from 1982, pit stops and qualifying from 1994, sprints from 2021, constructor standings from 1958.']);
  // status colours on the check tables
  const setStatus = (label, ref, entity, measure) => {
    const v = p.visuals.find((x) => x.label === label).json.visual;
    v.objects.values = [...(v.objects.values || []), statusColour(ref, entity, measure)];
  };
  setStatus('dq_tables', 'DQ Tables.DQ Status', 'DQ Tables', 'DQ Table Status Ink');
  setStatus('dq_raw', 'DQ Raw Profile.DQ Profile Status', 'DQ Raw Profile', 'DQ Profile Status Ink');
  setStatus('dq_missing', 'DQ Columns.DQ Missing Status', 'DQ Columns', 'DQ Missing Status Ink');
  setStatus('standings_check', `${RR}.Standings Gap Status`, RR, 'Standings Gap Status Ink');
  noFilterFrom(p, ['dq_tables', 'dq_raw', 'dq_missing', 'standings_check', 'status_lookup', 'constructor_identity', 'partial_seasons']);
  return p;
}

module.exports = { explorer, explorerHeight, quali, pits, eras, quality, qualityHeight };
