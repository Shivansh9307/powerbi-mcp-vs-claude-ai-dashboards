// Reconciliation tests: every aggregate shown on the dashboard must tie out to an independent calculation.
// Run:  node tests/reconcile.test.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { F1, errors } = require('./harness.js');
F1.loadCore();
const M = F1.M;
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ok  ', name); } catch (e) { console.log('  FAIL', name, '\n       ', e.message); process.exitCode = 1; } };
const full = () => ({ y0: M.minYear, y1: M.maxYear, driver: null, cons: null, circuit: null });
const id = (map, name) => [...map.values()].find((x) => x.name === name).id;
const ham = id(M.drivers, 'Lewis Hamilton'), fer = id(M.cons, 'Ferrari'), monza = [...M.circuits.values()].find((c) => c.name.includes('Monza')).id;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test('wins: Σ drivers = Σ constructors = winning result rows', () => {
  const rows = M.results.filter((x) => x.p === 1).length;
  assert.strictEqual(F1.leaderboard('driver', full(), null).reduce((s, a) => s + a.wins, 0), rows);
  assert.strictEqual(F1.leaderboard('cons', full(), null).reduce((s, a) => s + a.wins, 0), rows);
});

test('entity KPIs equal their leaderboard row (driver, constructor)', () => {
  for (const [kind, key, eid] of [['driver', 'driver', ham], ['cons', 'cons', fer]]) {
    const st = Object.assign(full(), { [key]: eid });
    const a = F1.aggregate(F1.rows(st), F1.sprintRows(st));
    const row = F1.leaderboard(kind, full(), null).find((x) => x.id === eid);
    for (const f of ['starts', 'wins', 'podiums', 'poles', 'totalPts', 'races']) near(a[f], row[f], `${kind} ${f}`);
  }
});

test('constructor filter: Σ its drivers\' wins = constructor wins (field stays scoped)', () => {
  const st = Object.assign(full(), { cons: fer });
  const drivers = F1.leaderboard('driver', st, 'driver').reduce((s, a) => s + a.wins, 0);
  assert.strictEqual(drivers, F1.aggregate(F1.rows(st)).wins);
});

test('season ranges are additive (starts, wins, points)', () => {
  const A = Object.assign(full(), { y0: 1950, y1: 1999 }), B = Object.assign(full(), { y0: 2000, y1: 2026 });
  const [a, b, t] = [A, B, full()].map((s) => F1.aggregate(F1.rows(s), F1.sprintRows(s)));
  for (const f of ['starts', 'wins', 'totalPts', 'podiums']) near(a[f] + b[f], t[f], f);
});

test('titles equal an independent read of the standings file', () => {
  const raceYear = new Map(M.races.map((r) => [r.id, r])), last = new Map();
  M.races.filter((r) => r.done).forEach((r) => { const c = last.get(r.year); if (!c || r.round > c.round) last.set(r.year, r); });
  const csv = fs.readFileSync(path.join(__dirname, '..', 'data', 'std_drivers.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const champs = new Map();
  csv.forEach(([r, d, pt, po]) => { const race = raceYear.get(r); if (po === '1' && last.get(race.year).id === r) champs.set(race.year, d); });
  const complete = M.years.filter((y) => M.seasons.get(y).complete);
  assert.strictEqual(complete.length, 76);
  complete.forEach((y) => assert.strictEqual(M.champD.get(y).d, champs.get(y), 'champion ' + y));
  assert.strictEqual(F1.titles(full()).drivers.length, complete.length);
});

test('a partial season never produces a title', () => {
  assert.ok(M.years.some((y) => !M.seasons.get(y).complete));
  assert.ok(F1.titles(full()).drivers.every((c) => M.seasons.get(c.year).complete));
});

test('titles are undefined (not zero) under a circuit filter', () => {
  const t = F1.titles(Object.assign(full(), { circuit: monza }));
  assert.ok(t.driverNA && t.consNA);
});

test('classification follows positionText: retired / disqualified / withdrawn rows are never classified', () => {
  const raw = path.join(__dirname, '..', '..', 'results.csv');
  if (!fs.existsSync(raw)) return;                       // raw files are not shipped with the dashboard
  const lines = fs.readFileSync(raw, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(','), iT = head.indexOf('positionText'), iR = head.indexOf('resultId');
  const nonDigit = new Set(lines.slice(1).map((l) => l.split(',')).filter((c) => !/^\d+$/.test(c[iT])).map((c) => c[iR]));
  assert.ok(nonDigit.size > 1000);
  const withPos = M.results.length;                      // every unclassified raw row must have p === null in the model
  const classifiedRaw = lines.length - 1 - nonDigit.size;
  assert.strictEqual(M.results.filter((x) => x.p != null).length, classifiedRaw, 'classified rows must equal raw rows with a numeric positionText');
  assert.ok(withPos > 0);
});

test('modern seasons do not report ~100% classified finishers', () => {
  const rows = F1.rows({ y0: 2025, y1: 2025, driver: null, cons: null, circuit: null });
  const a = F1.aggregate(rows);
  assert.ok(a.finRate < 0.95, 'finRate 2025 = ' + a.finRate);
});

test('missing grid / position never becomes a pole or a podium', () => {
  const noGrid = M.results.filter((x) => x.g == null || x.g === 0);
  const a = F1.aggregate(noGrid);
  assert.strictEqual(a.poles, 0);
  assert.strictEqual(F1.aggregate(M.results.filter((x) => x.p == null)).podiums, 0);   // note: JS null <= 3 is true, so guards matter
});

test('era-normalised points stay within a sane band', () => {
  F1.leaderboard('driver', full(), null).filter((a) => a.starts >= 10).forEach((a) => assert.ok(a.norm >= 0 && a.norm < 1.1, `${a.name} ${a.norm}`));
});

test('contradictory filters are cleared with an explanation', () => {
  F1.resetState();
  const notes = F1.setState({ driver: ham }).concat(F1.setState({ y0: 1950, y1: 1960 }));
  assert.ok(notes.length && F1.state.driver === null, 'driver should be cleared outside his seasons');
  F1.resetState();
});

test('every page renders for 8 filter states without chart NaNs', () => {
  const pages = ['overview', 'drivers', 'constructors', 'races', 'quali', 'pits', 'eras', 'quality'];
  [{}, { driver: ham }, { cons: fer }, { circuit: monza }, { y0: 2026, y1: 2026 }, { y0: 1950, y1: 1957 }, { y0: 2021, y1: 2024 }, { driver: ham, cons: id(M.cons, 'Mercedes'), y0: 2013, y1: 2026 }].forEach((st) => {
    F1.resetState(); F1.setState(st);
    pages.forEach((p) => { F1.ps.races = F1.ps.races || {}; F1.ps.races.view = p === 'races' && st.circuit ? 'circuit' : 'race'; assert.ok(F1.pages[p].render(), p); });
  });
  assert.deepStrictEqual(errors, []);
});

setTimeout(() => console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`), 30);
