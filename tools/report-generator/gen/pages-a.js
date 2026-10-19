// Pages 1-3 and the three tooltip pages (storytelling pass: grey context, one amber accent, action titles).
const L = require('./f1-lib.js');
const { C, X0, CW, BODY_Y, card, textbox, chart, table, scatter, slicer, shell, newPage, measureFilter, winnersFilter, rectShape } = L;

const IDS = {
  overview: 'a7c1e9d4b2f64c3a8e15', drivers: 'b1d2e3f4a5b6c7d8e9f0', constructors: 'c2e3f4a5b6c7d8e9f0a1', explorer: 'd3f4a5b6c7d8e9f0a1b2',
  quali: 'e4a5b6c7d8e9f0a1b2c3', pits: 'f5b6c7d8e9f0a1b2c3d4', eras: 'a6c7d8e9f0a1b2c3d4e5', quality: 'b7d8e9f0a1b2c3d4e5f6',
  ttDriver: 'c8e9f0a1b2c3d4e5f6a7', ttConstructor: 'd9f0a1b2c3d4e5f6a7b8', ttSeason: 'e0a1b2c3d4e5f6a7b8c9'
};
L.setPageIds(IDS);
const RR = 'Race Results';
const CHARTS = ['barChart', 'columnChart', 'clusteredColumnChart', 'clusteredBarChart', 'lineChart', 'tableEx', 'pivotTable', 'scatterChart', 'hundredPercentStackedColumnChart', 'lineClusteredColumnComboChart'];
const noFilterFrom = (p, sourceLabels) => {
  const src = p.visuals.filter((v) => sourceLabels.includes(v.label));
  const tgt = p.visuals.filter((v) => CHARTS.includes(v.json.visual.visualType));
  for (const s of src) for (const t of tgt) if (t !== s) p.interactions.push({ source: s.json.name, target: t.json.name, type: 'NoFilter' });
};

// =====================================================================
// 1. Overview: the story in one page (Big Idea in the headline, evidence below, detail last)
// =====================================================================
function overview() {
  const p = newPage('overview');
  shell(p, { title: 'Overview', headline: 'Headline Overview' });
  const y0 = BODY_Y;
  // context: seven plain numbers with their definitions in light grey
  const tiles = [
    ['Grands Prix', ['Race', '# Races Held'], 'Races run with results so far.'],
    ['Drivers', [RR, '# Drivers Started'], 'Drivers who started at least one race.'],
    ['Constructors', [RR, '# Constructors Started'], 'Teams with a car on the grid. Renames count apart.'],
    ['Circuits', [RR, '# Circuits Used'], 'Different tracks that hosted a race.'],
    ['Victories', [RR, 'Wins'], 'Race wins. A shared drive credits each driver.'],
    ["Drivers' titles", ['Driver Standings', 'Driver Titles'], 'Completed seasons only. 2026 awards none yet.'],
    ["Constructors' titles", ['Constructor Standings', 'Constructor Titles'], 'Completed seasons only, from 1958.']
  ];
  const gap = 16, tw = (CW - 6 * gap) / 7;
  tiles.forEach(([lab, m, def], i) => {
    const x = X0 + i * (tw + gap);
    card(p, `kpi_${i + 1}`, x, y0, tw, 60, { m: [m], labelText: lab, size: 26, alt: `${lab} KPI. ${def}`, display: 'none', labelSize: 12, padding: 2 });
    textbox(p, `kpi_${i + 1}_definition`, x, y0 + 60, tw, 40, [{ t: def, size: 13, color: C.muted }], `Definition of ${lab}: ${def}`, { padLeft: 4, padRight: 4 });
  });
  // hero: the three shifts that carry the Big Idea; first and last decade in amber
  const hy = y0 + 112, hh = 240, hw = (CW - 2 * gap) / 3;
  const decade = (i, m, title, alt) => chart(p, `decade_${i}`, X0 + i * (hw + gap), hy, hw, hh, { type: 'columnChart', cat: ['c', 'Season', 'Era'], y: [[RR, m]], title: { m: [RR, title] }, colorMeasure: [RR, 'Color Decade Ends'], labelPrec: 0, alt, labels: true, innerPadding: 12 });
  decade(0, 'Retirement Rate', 'Short Title Retirement', 'Column chart by decade of the share of starts that ended in retirement. The first and last decade in view are amber.');
  decade(1, 'Pole to Win Conversion', 'Short Title Pole Conversion', 'Column chart by decade of the share of pole positions converted into wins. The first and last decade in view are amber.');
  decade(2, 'Top Driver Share of Wins', 'Short Title Concentration', "Column chart by decade of the most successful driver's share of wins. The first and last decade in view are amber.");
  // support: how the sport changed over time, who won most
  const sy = hy + hh + 16, sh = 284;
  chart(p, 'evolution', X0, sy, 600, sh, {
    type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true,
    y: [[RR, 'Evolution Value (complete)', { displayName: 'Complete seasons' }], [RR, 'Evolution Value (in progress)', { displayName: 'Season in progress' }]],
    title: { m: [RR, 'Evolution Title'] }, labels: false, legend: true, valueAxisShow: true,
    colors: [[RR, 'Evolution Value (complete)', C.light], [RR, 'Evolution Value (in progress)', C.amber]], dashed: [[RR, 'Evolution Value (in progress)']],
    alt: 'Line chart by season of the metric chosen in the selector. The season still in progress is drawn as a dotted amber line.', tooltipPage: IDS.ttSeason
  });
  slicer(p, 'evolution_metric', X0 + 600 - 164, sy + 26, 156, 48, { entity: 'Evolution Metric', prop: 'Evolution Metric', header: 'Show', mode: 'Dropdown', selectAll: false, singleSelect: true, noHeader: true, alt: 'Choose which metric the evolution chart shows' });
  const lw = (CW - 600 - 2 * gap) / 2;
  chart(p, 'leaders_drivers', X0 + 616, sy, lw, sh, {
    type: 'barChart', cat: ['c', 'Driver', 'Driver'], y: [[RR, 'Leaderboard Value']], colorMeasure: [RR, 'Color Top Driver'], sort: ['m', RR, 'Leaderboard Value'], innerPadding: 8,
    title: { m: [RR, 'Action Leaderboard Drivers'] }, filters: [measureFilter(RR, 'Driver Leaderboard Rank', 4, 8)], tooltipPage: IDS.ttDriver,
    alt: 'Bar chart of the ten drivers with the highest value of the chosen metric. The leader is amber. Hover for a career summary.'
  });
  slicer(p, 'leaderboard_metric_drivers', X0 + 616 + lw - 138, sy + 4, 130, 48, { entity: 'Leaderboard Metric', prop: 'Leaderboard Metric', header: 'Rank by', mode: 'Dropdown', selectAll: false, singleSelect: true, noHeader: true, alt: 'Choose the metric that ranks drivers' });
  chart(p, 'leaders_teams', X0 + 616 + lw + gap, sy, lw, sh, {
    type: 'barChart', cat: ['c', 'Constructor', 'Constructor'], y: [[RR, 'Constructor Leaderboard Value']], colorMeasure: [RR, 'Color Top Constructor'], sort: ['m', RR, 'Constructor Leaderboard Value'], innerPadding: 8,
    title: { m: [RR, 'Action Leaderboard Constructors'] }, filters: [measureFilter(RR, 'Constructor Leaderboard Rank', 4, 8)], tooltipPage: IDS.ttConstructor,
    alt: 'Bar chart of the ten constructors with the highest value of the chosen metric. The leader is amber. Hover for a team summary.'
  });
  slicer(p, 'leaderboard_metric_teams', X0 + 616 + lw + gap + lw - 138, sy + 4, 130, 48, { entity: 'Constructor Metric', prop: 'Constructor Metric', header: 'Rank by', mode: 'Dropdown', selectAll: false, singleSelect: true, noHeader: true, alt: 'Choose the metric that ranks constructors' });
  // detail: two quiet tables
  const dy = sy + sh + 16, dh = 1066 - dy;
  table(p, 'champions', X0, dy, 640, dh, {
    cols: [['c', 'Season', 'Season'], ['m', 'Driver Standings', "Drivers' Champion"], ['m', 'Constructor Standings', "Constructors' Champion"]],
    sort: ['c', 'Season', 'Season', 'Descending'], left: ['Season.Season'], title: 'Champions by season (right-click a season to drill through)', tooltipPage: IDS.ttSeason,
    filters: [measureFilter('Race', '# Races Held', 2, 1)], fontSize: 10,
    alt: "Table of seasons in the selection, newest first, with the drivers' and constructors' champion. A season still in progress shows the current leader marked (leader). Right-click a season to drill through to the race explorer."
  });
  table(p, 'latest_races', X0 + 656, dy, CW - 656, dh, {
    cols: [['c', 'Race', 'Race Date'], ['c', 'Race', 'Race'], ['c', 'Driver', 'Driver'], ['c', 'Constructor', 'Constructor'], ['m', RR, 'Grid Slot Label', { displayName: 'Grid' }]],
    sort: ['c', 'Race', 'Race Date', 'Descending'], left: ['Race.Race Date'], title: 'Most recent 25 Grands Prix: winners', fontSize: 10,
    filters: [winnersFilter(), measureFilter(RR, 'Latest Race Rank', 4, 25)],
    alt: "Table of the 25 most recent Grands Prix in the selection with date, race, winning driver, winning constructor and the winner's starting slot. Pit lane or unrecorded starts are labelled; missing grids say Not recorded."
  });
  noFilterFrom(p, ['champions', 'latest_races']);
  return p;
}

// =====================================================================
// 2. Driver Intelligence
// =====================================================================
function drivers() {
  const p = newPage('drivers');
  shell(p, { title: 'Driver Intelligence', headline: 'Headline Driver', back: true });
  const y0 = BODY_Y;
  slicer(p, 'compare_driver', X0, y0, 264, 76, { entity: 'Compare Driver', prop: 'Compare Driver', header: 'Compare with', mode: 'Dropdown', selectAll: false, singleSelect: true, strict: false, filter: L.tf('drivers', 'compare', 'Compare Driver', 'Compare Driver'), alt: 'Choose a second driver for the head-to-head table' });
  const kpis = [
    ['Starts', RR, 'Starts', 'Races started'], ['Wins', RR, 'Wins', 'Race wins'], ['Podiums', RR, 'Podiums', 'Top-three finishes'], ['Poles', RR, 'Pole Positions', 'Starts from first on the grid'],
    ['Win rate', RR, 'Win Rate (%)', 'Wins per start'], ['Titles', 'Driver Standings', 'Driver Titles', 'Completed-season titles'], ['Points', RR, 'Recorded Points', 'Race plus sprint, own scoring'], ['Retirement rate', RR, 'Retirement Rate', 'Starts ending in retirement']
  ];
  const kx = X0 + 276, kw = (CW - 276 - 7 * 10) / 8;
  kpis.forEach(([lab, e, m, d], i) => card(p, `kpi_${i + 1}`, kx + i * (kw + 10), y0 + 6, kw, 64, { m: [[e, m]], labelText: lab, size: 24, alt: `${lab}: ${d}`, display: 'none', labelSize: 12, padding: 2 }));
  card(p, 'field_context', X0, y0 + 84, CW, 28, { m: [[RR, 'Field Context']], showLabel: false, size: 14, textColor: C.text2, padding: 2, alt: 'Where the selected driver ranks among all drivers in the same filters' });
  const r1 = y0 + 122, h1 = 300;
  chart(p, 'season_by_season', X0, r1, 760, h1, {
    type: 'clusteredColumnChart', cat: ['c', 'Season', 'Season'], y: [[RR, 'Wins'], [RR, 'Podiums']], title: 'Season by season: wins (amber) and podiums (grey)', legend: true, labels: false, valueAxisShow: true,
    colors: [[RR, 'Wins', C.amber], [RR, 'Podiums', C.ctx]], alt: 'Clustered columns by season of wins in amber and podiums in grey for the selected driver or drivers in view.', tooltipPage: IDS.ttSeason
  });
  scatter(p, 'grid_vs_finish', X0 + 780, r1, 392, h1, {
    cat: ['Race', 'Race Date'], xm: [RR, 'Average Grid'], ym: [RR, 'Average Finish'], title: 'Grid slot vs finishing position, one dot per race', xTitle: 'Average grid slot', yTitle: 'Average finish',
    alt: 'Scatter of starting slot against classified finishing position, one point per race. Points below the diagonal gained places. Pit-lane and missing grids are left out.'
  });
  table(p, 'constructor_history', X0 + 1192, r1, CW - 1192, h1, {
    cols: [['c', 'Constructor', 'Constructor'], ['m', RR, 'Starts'], ['m', RR, 'Wins'], ['m', RR, 'First Season', { displayName: 'From' }], ['m', RR, 'Last Season', { displayName: 'To' }]],
    sort: ['m', RR, 'Starts', 'Descending'], title: 'Constructor history', fontSize: 10, filters: [measureFilter(RR, 'Starts', 2, 1)],
    alt: 'Table of the constructors the driver raced for with starts, wins and first and last season.'
  });
  const r2 = r1 + h1 + 16, h2 = 1066 - r2;
  table(p, 'h2h', X0, r2, 620, h2, {
    cols: [['c', 'Season', 'Season'], ['m', RR, 'H2H Races Both Started', { displayName: 'Both started' }], ['m', RR, 'H2H Driver Ahead', { displayName: 'Selected ahead' }], ['m', RR, 'H2H Compare Ahead', { displayName: 'Comparison ahead' }]],
    sort: ['c', 'Season', 'Season', 'Descending'], left: ['Season.Season'], title: { m: [RR, 'H2H Title'] }, fontSize: 10, totals: true,
    filters: [measureFilter(RR, 'H2H Races Both Started', 2, 1)],
    alt: 'Table by season of races both drivers started and how often each finished ahead. Choose a second driver with the Compare with selector; blank until two different drivers are chosen.'
  });
  chart(p, 'driver_leaderboard', X0 + 636, r2, CW - 636, h2, {
    type: 'barChart', cat: ['c', 'Driver', 'Driver'], y: [[RR, 'Leaderboard Value']], colorMeasure: [RR, 'Color Top Driver'], sort: ['m', RR, 'Leaderboard Value'], innerPadding: 10, title: { m: [RR, 'Action Leaderboard Drivers'] },
    filters: [measureFilter(RR, 'Driver Leaderboard Rank', 4, 10)], tooltipPage: IDS.ttDriver, alt: 'All-time leaderboard of the ten drivers with the highest value of the chosen metric. The leader is amber.'
  });
  slicer(p, 'leaderboard_metric', X0 + CW - 146, r2 + 4, 138, 48, { noHeader: true, entity: 'Leaderboard Metric', prop: 'Leaderboard Metric', header: 'Rank by', mode: 'Dropdown', selectAll: false, singleSelect: true, alt: 'Choose the metric that ranks drivers' });
  noFilterFrom(p, ['constructor_history', 'h2h']);
  return p;
}

// =====================================================================
// 3. Constructor Analysis
// =====================================================================
function constructors() {
  const p = newPage('constructors');
  shell(p, { title: 'Constructor Analysis', headline: 'Headline Constructor', back: true });
  const y0 = BODY_Y;
  slicer(p, 'compare_constructor', X0, y0, 264, 76, { entity: 'Compare Constructor', prop: 'Compare Constructor', header: 'Compare with', mode: 'Dropdown', selectAll: false, singleSelect: true, strict: false, filter: L.tf('constructors', 'compare', 'Compare Constructor', 'Compare Constructor'), alt: 'Choose a second constructor for the head-to-head table' });
  const kpis = [
    ['Wins', RR, 'Wins'], ['Podiums', RR, 'Podiums'], ['Poles', RR, 'Pole Positions'], ["Constructors' titles", 'Constructor Standings', 'Constructor Titles'],
    ['Points', RR, 'Recorded Points'], ['Starts', RR, 'Starts'], ['Retirement rate', RR, 'Retirement Rate']
  ];
  const kx = X0 + 276, kw = (CW - 276 - 6 * 10) / 7;
  kpis.forEach(([lab, e, m], i) => card(p, `kpi_${i + 1}`, kx + i * (kw + 10), y0 + 6, kw, 64, { m: [[e, m]], labelText: lab, size: 24, alt: `${lab} for the selected constructor`, display: 'none', labelSize: 12, padding: 2 }));
  card(p, 'title_note', X0, y0 + 84, CW, 28, { m: [[RR, 'Constructor Title Note']], showLabel: false, size: 14, textColor: C.muted, padding: 2, alt: "When constructors' titles exist" });
  const r1 = y0 + 122, h1 = 340;
  // two aligned charts instead of a secondary axis: wins on top (peak in amber), points below
  chart(p, 'season_wins', X0, r1, 800, 190, {
    type: 'columnChart', cat: ['c', 'Season', 'Season'], y: [[RR, 'Wins']], colorMeasure: [RR, 'Color Peak Wins Season'], title: { m: [RR, 'Action Wins Trend'] }, labels: false, valueAxisShow: true, innerPadding: 6,
    alt: 'Columns by season of wins for the selected constructor. The season with the most wins is amber.', tooltipPage: IDS.ttSeason
  });
  chart(p, 'season_points', X0, r1 + 194, 800, h1 - 194, {
    type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, 'Recorded Points']], colors: [[RR, 'Recorded Points', C.light]], title: 'Championship points per season', labels: false, valueAxisShow: true,
    alt: 'Line by season of championship points for the selected constructor, sharing the same seasons as the chart above.'
  });
  chart(p, 'reliability', X0 + 816, r1, CW - 816, h1, {
    type: 'lineChart', cat: ['c', 'Season', 'Season'], scalar: true, y: [[RR, 'Mechanical Retirement Rate'], [RR, 'Accident Retirement Rate'], [RR, 'Other Retirement Rate']], title: { m: [RR, 'Action Reliability'] },
    legend: true, labels: false, valueAxisShow: true, colors: [[RR, 'Mechanical Retirement Rate', C.amber], [RR, 'Accident Retirement Rate', C.text2], [RR, 'Other Retirement Rate', C.ctx]],
    alt: 'Lines by season of the share of starts that ended in a mechanical failure (amber), an accident or another retirement.'
  });
  const r2 = r1 + h1 + 16, h2 = 1066 - r2;
  chart(p, 'driver_contributions', X0, r2, 400, h2, {
    type: 'barChart', cat: ['c', 'Driver', 'Driver'], y: [[RR, 'Wins']], colorMeasure: [RR, 'Color Top Wins Driver'], sort: ['m', RR, 'Wins'], title: 'Wins by driver: who delivered them (top 10)', filters: [measureFilter(RR, 'Driver Wins Rank', 4, 10)], tooltipPage: IDS.ttDriver, innerPadding: 10,
    alt: 'Bar chart of wins by driver for the selected constructor, top ten. The top driver is amber.'
  });
  table(p, 'h2h_constructors', X0 + 416, r2, 470, h2, {
    cols: [['c', 'Season', 'Season'], ['m', RR, 'Cmp Points A', { displayName: 'Selected pts' }], ['m', RR, 'Cmp Points B', { displayName: 'Comparison pts' }], ['m', RR, 'Cmp Wins A', { displayName: 'Wins' }], ['m', RR, 'Cmp Wins B', { displayName: 'Comp. wins' }], ['m', RR, 'Cmp Ahead', { displayName: 'Ahead' }]],
    sort: ['c', 'Season', 'Season', 'Descending'], left: ['Season.Season'], title: { m: [RR, 'Cmp Title'] }, fontSize: 10,
    filters: [measureFilter(RR, 'Starts', 2, 1)],
    alt: 'Table by season of points and wins for the selected and comparison constructor, and which scored the higher era-normalised points share.'
  });
  chart(p, 'constructor_leaderboard', X0 + 902, r2, 394, h2, {
    type: 'barChart', cat: ['c', 'Constructor', 'Constructor'], y: [[RR, 'Constructor Leaderboard Value']], colorMeasure: [RR, 'Color Top Constructor'], sort: ['m', RR, 'Constructor Leaderboard Value'], title: { m: [RR, 'Action Leaderboard Constructors'] }, innerPadding: 10,
    filters: [measureFilter(RR, 'Constructor Leaderboard Rank', 4, 10)], tooltipPage: IDS.ttConstructor, alt: 'Leaderboard of the ten constructors with the highest value of the chosen metric. The leader is amber.'
  });
  slicer(p, 'constructor_metric', X0 + 902 + 394 - 146, r2 + 4, 138, 48, { noHeader: true, entity: 'Constructor Metric', prop: 'Constructor Metric', header: 'Rank by', mode: 'Dropdown', selectAll: false, singleSelect: true, alt: 'Choose the metric that ranks constructors' });
  table(p, 'rename_caveat', X0 + 1312, r2, CW - 1312, h2, {
    cols: [['c', 'Constructor Families', 'Family'], ['c', 'Constructor Families', 'Names']], title: 'Possible renames (not merged)', fontSize: 10,
    alt: 'Caveat table of constructors whose names share a first word, which may be renames or successors. The model treats each as a separate team.'
  });
  noFilterFrom(p, ['h2h_constructors', 'rename_caveat']);
  return p;
}

// =====================================================================
// Tooltip pages (320 x 240): quiet numbers, no accent bars
// =====================================================================
function tooltipPage(name, title, items) {
  const p = newPage(name);
  p.tooltip = true; p.size = [320, 240];
  rectShape(p, 'tt_bg', 0, 0, 320, 240, C.surfaceAlt, 'Tooltip background');
  textbox(p, 'tt_title', 14, 10, 292, 26, [{ t: title, size: 14, font: 'Segoe UI Semibold' }], title);
  const cw = 140, ch = 46;
  let col = 0, row = 0;
  items.forEach(([lab, e, m, wide], i) => {
    if (wide && col === 1) { col = 0; row++; }
    const x = 14 + col * (cw + 12), y = 40 + row * (ch + 2);
    card(p, `tt_${i + 1}`, x, y, wide ? 2 * cw + 12 : cw, ch, { m: [[e, m]], labelText: lab, size: wide ? 14 : 15, labelSize: 11, padding: 0, alt: lab, display: 'none' });
    if (wide) { col = 0; row++; } else if (col === 1) { col = 0; row++; } else col = 1;
  });
  return p;
}
function tooltips() {
  return [
    Object.assign(tooltipPage('tt_driver', 'Driver at a glance', [
      ['Starts', RR, 'Starts'], ['Wins', RR, 'Wins'], ['Podiums', RR, 'Podiums'], ['Poles', RR, 'Pole Positions'],
      ['Titles', 'Driver Standings', 'Driver Titles'], ['Win rate', RR, 'Win Rate (%)'], ['First season', RR, 'First Season'], ['Last season', RR, 'Last Season']
    ]), { id: IDS.ttDriver, display: 'Driver tooltip' }),
    Object.assign(tooltipPage('tt_constructor', 'Constructor at a glance', [
      ['Starts', RR, 'Starts'], ['Wins', RR, 'Wins'], ['Podiums', RR, 'Podiums'], ['Poles', RR, 'Pole Positions'],
      ["Constructors' titles", 'Constructor Standings', 'Constructor Titles'], ['Retirement rate', RR, 'Retirement Rate'], ['First season', RR, 'First Season'], ['Last season', RR, 'Last Season']
    ]), { id: IDS.ttConstructor, display: 'Constructor tooltip' }),
    Object.assign(tooltipPage('tt_season', 'Season at a glance', [
      ['Grands Prix', 'Race', '# Races Held'], ['Different winners', RR, '# Race Winners'], ["Drivers' champion", 'Driver Standings', "Drivers' Champion", true], ["Constructors' champion", 'Constructor Standings', "Constructors' Champion", true],
      ['Title margin (pts)', 'Driver Standings', 'Title Margin (points)'], ['Retirement rate', RR, 'Retirement Rate']
    ]), { id: IDS.ttSeason, display: 'Season tooltip' })
  ];
}

module.exports = { IDS, overview, drivers, constructors, tooltips };
