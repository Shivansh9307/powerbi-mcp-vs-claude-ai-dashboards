/* F1 Evolution - core: typing, relations, filters, metrics.  No DOM in this file. */
(function () {
  'use strict';
  const F1 = (window.F1 = window.F1 || {});
  F1.pages = F1.pages || {};   // page registry (filled by pages*.js, read by main.js)
  F1.ps = F1.ps || {};         // page-local UI state

  /* ------------------------------------------------------------------ helpers */
  const isNull = (v) => v === '' || v == null;
  const N = (v) => (isNull(v) ? null : +v);
  const safeFmt = (f) => (v) => (v == null || (typeof v === 'number' && !isFinite(v)) ? '—' : f(v));
  const fmt = {
    int: safeFmt(d3.format(',')),
    d1: safeFmt(d3.format(',.1f')),
    d2: safeFmt(d3.format(',.2f')),
    pts: safeFmt(d3.format(',.2~f')),
    p0: safeFmt(d3.format('.0%')),
    p1: safeFmt(d3.format('.1%')),
    lap: safeFmt((ms) => {
      const m = Math.floor(ms / 60000), s = (ms - m * 60000) / 1000;
      return (m ? m + ':' + (s < 10 ? '0' : '') : '') + s.toFixed(3);
    }),
    sec: safeFmt((ms) => (ms / 1000).toFixed(2) + ' s'),
    signed: safeFmt((v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1)),
  };
  F1.fmt = fmt;
  F1.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  F1.SG = ['Finished', 'Lapped', 'Mechanical DNF', 'Accident DNF', 'Disqualified', 'Other DNF', 'Did not start'];
  F1.SG_SHORT = ['Fin', 'Lap', 'Mech', 'Acc', 'DSQ', 'Oth', 'DNS'];

  /* ------------------------------------------------------------------ build model */
  F1.build = function (raw) {
    const M = { raw: {} };
    M.drivers = new Map(raw.drivers.map((r) => [r.id, { id: r.id, name: r.name, code: r.code, nat: r.nat, dob: r.dob }]));
    M.cons = new Map(raw.cons.map((r) => [r.id, { id: r.id, name: r.name, nat: r.nat }]));
    M.circuits = new Map(raw.circuits.map((r) => [r.id, { id: r.id, name: r.name, loc: r.loc, country: r.country }]));
    M.status = new Map(raw.status.map((r) => [r.id, { id: r.id, status: r.status, group: +r.group }]));

    M.races = raw.races.map((r, i) => {
      const o = {
        id: r.id, ord: i, year: +r.year, round: +r.round, name: r.name, date: r.date, circuit: r.circuit,
        done: r.done === '1', entries: +r.entries, starters: N(r.starters), wpts: N(r.wpts), spts: N(r.spts),
        sprint: r.sprint === '1', nq: +r.nq, nlap: +r.nlap, npit: +r.npit, lapmed: N(r.lapmed), lapbest: N(r.lapbest),
        laps: N(r.laps),
      };
      o.mx = (o.wpts || 0) + (o.spts || 0);
      return o;
    });
    M.raceById = new Map(M.races.map((r) => [r.id, r]));
    M.lastDate = d3.max(M.races.filter((r) => r.done), (r) => r.date);

    /* seasons */
    M.years = [...new Set(M.races.map((r) => r.year))].sort((a, b) => a - b);
    M.seasons = new Map();
    M.years.forEach((y) => {
      const rs = M.races.filter((r) => r.year === y);
      const held = rs.filter((r) => r.done);
      M.seasons.set(y, {
        year: y, sched: rs.length, held: held.length, complete: held.length === rs.length,
        lastRace: held.length ? held[held.length - 1] : null, maxAvail: d3.sum(held, (r) => r.mx),
        sprints: held.filter((r) => r.sprint).length, races: rs,
      });
    });
    M.minYear = M.years[0]; M.maxYear = M.years[M.years.length - 1];

    /* results */
    const mk = (r, isSprint) => {
      const race = M.raceById.get(r.r);
      return {
        r: r.r, ord: race.ord, y: race.year, rd: race.round, ci: race.circuit, d: r.d, c: r.c, g: N(r.g), p: N(r.p),
        o: +r.o, pt: +r.pt, l: N(r.l), s: +r.s, si: isSprint ? null : N(r.si), fr: isSprint ? null : N(r.fr), mx: race.mx,
      };
    };
    const cmp = (a, b) => a.ord - b.ord || a.o - b.o;
    M.results = raw.results.map((r) => mk(r, false)).sort(cmp);
    M.sprints = raw.sprints.map((r) => mk(r, true)).sort(cmp);
    const yIndex = (arr) => {
      const idx = new Map();
      arr.forEach((x, i) => { const e = idx.get(x.y); if (!e) idx.set(x.y, [i, i + 1]); else e[1] = i + 1; });
      return idx;
    };
    M.resIdx = yIndex(M.results); M.sprIdx = yIndex(M.sprints);
    M.resByRace = d3.group(M.results, (x) => x.r);

    /* standings: final snapshot per season (= last race with results) */
    const stdGroup = (rows, key) => d3.group(rows.map((x) => ({ r: x.r, k: x[key], pt: +x.pt, po: N(x.po), w: N(x.w) })), (x) => x.r);
    const sd = stdGroup(raw.stdD, 'd'), sc = stdGroup(raw.stdC, 'c');
    M.stdD = sd; M.stdC = sc;
    const order = (a, b) => (a.po ?? 999) - (b.po ?? 999) || b.pt - a.pt;
    M.finalD = new Map(); M.finalC = new Map(); M.champD = new Map(); M.champC = new Map();
    M.seasons.forEach((s, y) => {
      if (!s.lastRace) return;
      const dRows = (sd.get(s.lastRace.id) || []).slice().sort(order);
      const cRows = (sc.get(s.lastRace.id) || []).slice().sort(order);
      M.finalD.set(y, dRows); M.finalC.set(y, cRows);
      if (dRows.length) {
        let top = dRows.find((x) => x.po === 1), recalc = false;
        if (!top) { top = dRows[0]; recalc = true; }
        const second = dRows.find((x) => x !== top);
        M.champD.set(y, { year: y, d: top.k, pt: top.pt, w: top.w, margin: second ? top.pt - second.pt : null, complete: s.complete, recalc });
      }
      if (cRows.length) {
        let top = cRows.find((x) => x.po === 1), recalc = false;
        if (!top) { top = cRows[0]; recalc = true; }
        const second = cRows.find((x) => x !== top);
        M.champC.set(y, { year: y, c: top.k, pt: top.pt, w: top.w, margin: second ? top.pt - second.pt : null, complete: s.complete, recalc });
      }
    });

    /* driver-season team = constructor with most race entries that season (ties -> later) */
    const tally = new Map();
    M.results.forEach((x) => {
      if (x.s === 6) return;
      const k = x.d + '|' + x.y, m = tally.get(k) || new Map();
      m.set(x.c, (m.get(x.c) || 0) + 1); tally.set(k, m);
    });
    M.dsTeam = new Map();
    tally.forEach((m, k) => { let best = null, n = -1; m.forEach((v, c) => { if (v >= n) { n = v; best = c; } }); M.dsTeam.set(k, best); });
    M.champD.forEach((ch) => { ch.team = M.dsTeam.get(ch.d + '|' + ch.year) || null; });

    /* season totals (all entries, unfiltered) */
    M.seasonTot = new Map();
    M.years.forEach((y) => M.seasonTot.set(y, { pts: 0, winsByDriver: new Map(), winsByCons: new Map(), ptsByCons: new Map(), ptsByDriver: new Map(), starts: 0, drivers: new Set(), cons: new Set() }));
    M.results.forEach((x) => {
      const t = M.seasonTot.get(x.y);
      if (x.s === 6) return;
      t.pts += x.pt; t.starts++; t.drivers.add(x.d); t.cons.add(x.c);
      t.ptsByCons.set(x.c, (t.ptsByCons.get(x.c) || 0) + x.pt);
      t.ptsByDriver.set(x.d, (t.ptsByDriver.get(x.d) || 0) + x.pt);
      if (x.p === 1) {
        t.winsByDriver.set(x.d, (t.winsByDriver.get(x.d) || 0) + 1);
        t.winsByCons.set(x.c, (t.winsByCons.get(x.c) || 0) + 1);
      }
    });
    M.sprints.forEach((x) => {
      const t = M.seasonTot.get(x.y);
      t.pts += x.pt; t.ptsByCons.set(x.c, (t.ptsByCons.get(x.c) || 0) + x.pt); t.ptsByDriver.set(x.d, (t.ptsByDriver.get(x.d) || 0) + x.pt);
    });

    /* first / last season per entity */
    M.span = { d: new Map(), c: new Map(), ci: new Map() };
    M.results.forEach((x) => {
      if (x.s === 6) return;
      [['d', x.d], ['c', x.c], ['ci', x.ci]].forEach(([k, id]) => {
        const e = M.span[k].get(id);
        if (!e) M.span[k].set(id, [x.y, x.y]); else e[1] = x.y;
      });
    });
    return M;
  };

  /* ------------------------------------------------------------------ filter state */
  const ERAS = [
    { id: 'all', label: 'All seasons', y0: 1950, y1: 2026 },
    { id: '1950', label: '1950s', y0: 1950, y1: 1959 }, { id: '1960', label: '1960s', y0: 1960, y1: 1969 },
    { id: '1970', label: '1970s', y0: 1970, y1: 1979 }, { id: '1980', label: '1980s', y0: 1980, y1: 1989 },
    { id: '1990', label: '1990s', y0: 1990, y1: 1999 }, { id: '2000', label: '2000s', y0: 2000, y1: 2009 },
    { id: '2010', label: '2010s', y0: 2010, y1: 2019 }, { id: '2020', label: '2020s', y0: 2020, y1: 2026 },
    { id: 'hyb', label: 'Hybrid 2014→', y0: 2014, y1: 2026, ext: true },
  ];
  F1.ERAS = ERAS;
  F1.state = { y0: 1950, y1: 2026, driver: null, cons: null, circuit: null };
  F1.notices = [];
  const cache = new Map();
  F1.clearCache = () => cache.clear();

  function sliceRows(arr, idx, y0, y1) {
    let lo = null, hi = null;
    for (let y = y0; y <= y1; y++) {
      const e = idx.get(y);
      if (!e) continue;
      if (lo == null) lo = e[0];
      hi = e[1];
    }
    return lo == null ? [] : arr.slice(lo, hi);
  }
  /* rows (results) matching the state; `skip` ignores one dimension ('driver'|'cons'|'circuit') */
  F1.rows = function (st, skip, kind) {
    const M = F1.M, key = [kind || 'r', st.y0, st.y1, skip === 'driver' ? '' : st.driver, skip === 'cons' ? '' : st.cons, skip === 'circuit' ? '' : st.circuit].join('|');
    if (cache.has(key)) return cache.get(key);
    const sprint = kind === 's';
    let rows = sliceRows(sprint ? M.sprints : M.results, sprint ? M.sprIdx : M.resIdx, st.y0, st.y1);
    const d = skip === 'driver' ? null : st.driver, c = skip === 'cons' ? null : st.cons, ci = skip === 'circuit' ? null : st.circuit;
    if (d || c || ci) rows = rows.filter((x) => (!d || x.d === d) && (!c || x.c === c) && (!ci || x.ci === ci));
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    cache.set(key, rows);
    return rows;
  };
  F1.sprintRows = (st, skip) => F1.rows(st, skip, 's');

  /* validated state change: keeps the selection internally consistent and explains what it cleared */
  F1.setState = function (patch) {
    const M = F1.M, st = Object.assign({}, F1.state, patch);
    const notes = [];
    if (st.y0 > st.y1) { if ('y0' in patch) st.y1 = st.y0; else st.y0 = st.y1; notes.push('Season range adjusted so “from” is not after “to”.'); }
    st.y0 = Math.max(M.minYear, st.y0); st.y1 = Math.min(M.maxYear, st.y1);
    const names = { driver: (id) => M.drivers.get(id).name, cons: (id) => M.cons.get(id).name, circuit: (id) => M.circuits.get(id).name };
    const labels = { driver: 'driver', cons: 'constructor', circuit: 'circuit' };
    const keys = ['driver', 'cons', 'circuit'];
    // entity just picked wins; clear other entities that would leave no starts
    for (const k of keys) {
      if (!st[k] || k in patch) continue;
      const others = Object.assign({}, st);
      const n = F1.rows(others, null).some((x) => x.s !== 6);
      if (!n) { notes.push(`Cleared ${labels[k]} “${names[k](st[k])}”: no race starts together with the other selections in ${st.y0}–${st.y1}.`); st[k] = null; }
    }
    if (keys.some((k) => st[k]) && !F1.rows(st, null).some((x) => x.s !== 6)) {
      // the newly picked entity itself is empty in this range -> reject the pick
      keys.forEach((k) => { if (k in patch && patch[k]) { notes.push(`No starts for ${names[k](patch[k])} in ${st.y0}–${st.y1}; selection not applied.`); st[k] = F1.state[k]; } });
    }
    F1.state = st;
    F1.notices = notes;
    return notes;
  };
  F1.resetState = function () { F1.state = { y0: F1.M.minYear, y1: F1.M.maxYear, driver: null, cons: null, circuit: null }; F1.notices = []; };
  F1.isFiltered = () => { const s = F1.state, M = F1.M; return s.y0 !== M.minYear || s.y1 !== M.maxYear || s.driver || s.cons || s.circuit; };

  /* options for the three entity pickers, restricted to what the OTHER filters allow */
  F1.options = function (kind) {
    const M = F1.M, key = 'opt|' + kind + '|' + JSON.stringify(F1.state);
    if (cache.has(key)) return cache.get(key);
    const rows = F1.rows(F1.state, kind), seen = new Map();
    rows.forEach((x) => { if (x.s === 6) return; const id = kind === 'driver' ? x.d : kind === 'cons' ? x.c : x.ci; seen.set(id, (seen.get(id) || 0) + 1); });
    const dict = kind === 'driver' ? M.drivers : kind === 'cons' ? M.cons : M.circuits;
    const out = [...seen].map(([id, n]) => ({ id, name: dict.get(id).name, sub: kind === 'driver' ? dict.get(id).code || '' : kind === 'circuit' ? dict.get(id).country : dict.get(id).nat, n }));
    out.sort((a, b) => a.name.localeCompare(b.name));
    cache.set(key, out);
    return out;
  };

  F1.partialYearsIn = (st) => { const out = []; for (let y = st.y0; y <= st.y1; y++) { const s = F1.M.seasons.get(y); if (s && !s.complete) out.push(s); } return out; };

  /* ------------------------------------------------------------------ aggregation */
  const newAgg = () => ({ entries: 0, starts: 0, races: 0, lr: null, wins: 0, podiums: 0, poles: 0, polesWon: 0, fl: 0, pts: 0, sprintPts: 0, maxAvail: 0, classified: 0, finS: 0, finN: 0, gridS: 0, gridN: 0, gainS: 0, gainN: 0, sg: [0, 0, 0, 0, 0, 0, 0], seasons: new Set() });
  function add(a, x) {
    a.entries++;
    if (x.s === 6) { a.sg[6]++; return; }
    a.starts++; a.sg[x.s]++; a.seasons.add(x.y);
    if (x.r !== a.lr) { a.races++; a.lr = x.r; }
    a.pts += x.pt; a.maxAvail += x.mx;
    if (x.fr === 1) a.fl++;
    if (x.p != null) {
      a.classified++; a.finS += x.p; a.finN++;
      if (x.p === 1) a.wins++;
      if (x.p <= 3) a.podiums++;
      if (x.g >= 1) { a.gainS += x.g - x.p; a.gainN++; }
    }
    if (x.g >= 1) { a.gridS += x.g; a.gridN++; }
    if (x.g === 1) { a.poles++; if (x.p === 1) a.polesWon++; }
  }
  function finish(a) {
    const s = a.starts, tot = a.pts + a.sprintPts;
    a.totalPts = tot;
    a.winPct = s ? a.wins / s : null;
    a.podPct = s ? a.podiums / s : null;
    a.poleRate = s ? a.poles / s : null;
    a.conv = a.poles ? a.polesWon / a.poles : null;
    const dnf = a.sg[2] + a.sg[3] + a.sg[5];
    a.dnf = dnf;
    a.dnfRate = s ? dnf / s : null; a.mechRate = s ? a.sg[2] / s : null; a.accRate = s ? a.sg[3] / s : null;
    a.finRate = s ? a.classified / s : null;
    a.avgFin = a.finN ? a.finS / a.finN : null; a.avgGrid = a.gridN ? a.gridS / a.gridN : null;
    a.gain = a.gainN ? a.gainS / a.gainN : null;
    a.ppS = s ? tot / s : null;
    a.norm = a.maxAvail ? tot / a.maxAvail : null;
    a.nSeasons = a.seasons.size;
    return a;
  }
  F1.aggregate = function (rows, sprints) {
    const a = newAgg(); rows.forEach((x) => add(a, x)); (sprints || []).forEach((x) => { a.sprintPts += x.pt; }); return finish(a);
  };
  /* group rows by key -> Map(key -> agg); sprint points are added under the same key */
  F1.groupAgg = function (rows, keyFn, sprints) {
    const m = new Map();
    rows.forEach((x) => { const k = keyFn(x); let a = m.get(k); if (!a) { a = newAgg(); m.set(k, a); } add(a, x); });
    (sprints || []).forEach((x) => { const a = m.get(keyFn(x)); if (a) a.sprintPts += x.pt; });
    m.forEach(finish);
    return m;
  };

  /* titles (complete seasons only, from FINAL STANDINGS - never inferred from wins) */
  F1.titles = function (st, skip) {
    const M = F1.M, d = skip === 'driver' ? null : st.driver, c = skip === 'cons' ? null : st.cons;
    const out = { driverNA: !!st.circuit, consNA: !!st.circuit || !!d, drivers: [], cons: [] };
    if (out.driverNA) return out;
    M.champD.forEach((ch) => {
      if (!ch.complete || ch.year < st.y0 || ch.year > st.y1) return;
      if (d && ch.d !== d) return;
      if (c && ch.team !== c) return;
      out.drivers.push(ch);
    });
    if (!out.consNA) M.champC.forEach((ch) => {
      if (!ch.complete || ch.year < st.y0 || ch.year > st.y1) return;
      if (c && ch.c !== c) return;
      out.cons.push(ch);
    });
    return out;
  };

  /* driver / constructor leaderboards (skip: dimension ignored so the field stays visible) */
  F1.leaderboard = function (kind, st, skip) {
    const M = F1.M, key = 'lb|' + kind + '|' + JSON.stringify(st) + '|' + skip;
    if (cache.has(key)) return cache.get(key);
    const rows = F1.rows(st, skip), spr = F1.sprintRows(st, skip), k = kind === 'driver' ? 'd' : 'c';
    const g = F1.groupAgg(rows, (x) => x[k], spr);
    const tt = F1.titles(st, skip), titleMap = new Map();
    (kind === 'driver' ? tt.drivers.map((x) => x.d) : tt.cons.map((x) => x.c)).forEach((id) => titleMap.set(id, (titleMap.get(id) || 0) + 1));
    const dict = kind === 'driver' ? M.drivers : M.cons;
    const out = [];
    g.forEach((a, id) => {
      if (!a.starts) return;
      const e = dict.get(id), sp = M.span[k].get(id) || [0, 0];
      out.push(Object.assign(a, { id, name: e.name, nat: e.nat, code: e.code || '', titles: titleMap.get(id) || 0, y0: sp[0], y1: sp[1] }));
    });
    out.titlesNA = kind === 'driver' ? tt.driverNA : tt.consNA;
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  };

  /* per-season aggregates for the current selection (used by trend charts) */
  F1.seasonSeries = function (st, skip) {
    const M = F1.M, rows = F1.rows(st, skip), spr = F1.sprintRows(st, skip);
    const g = F1.groupAgg(rows, (x) => x.y, spr), out = [];
    for (let y = st.y0; y <= st.y1; y++) {
      const s = M.seasons.get(y); if (!s) continue;
      const a = g.get(y);
      out.push({ year: y, season: s, a: a && a.starts ? a : null });
    }
    return out;
  };

  /* head-to-head between two drivers: races both started; ahead = lower positionOrder */
  F1.headToHead = function (idA, idB, st) {
    const M = F1.M, rowsA = new Map(), res = { shared: 0, aheadA: 0, aheadB: 0, sameTeam: 0, tmA: 0, tmB: 0, ptsA: 0, ptsB: 0, years: new Set() };
    F1.rows(st, 'driver').forEach((x) => { if (x.d === idA && x.s !== 6) rowsA.set(x.r, x); });
    F1.rows(st, 'driver').forEach((x) => {
      if (x.d !== idB || x.s === 6) return;
      const a = rowsA.get(x.r); if (!a) return;
      res.shared++; res.years.add(x.y);
      const aheadA = a.o < x.o;
      if (aheadA) res.aheadA++; else res.aheadB++;
      if (a.c === x.c) { res.sameTeam++; if (aheadA) res.tmA++; else res.tmB++; }
    });
    return res;
  };

  /* ------------------------------------------------------------------ lazy fact tables */
  F1.ext = {};
  const EXT = {
    fact_quali: (r) => ({ r: r.r, y: F1.M.raceById.get(r.r).year, ord: F1.M.raceById.get(r.r).ord, d: r.d, c: r.c, p: N(r.p), q1: N(r.q1), q2: N(r.q2), q3: N(r.q3) }),
    fact_pits: (r) => ({ r: r.r, y: F1.M.raceById.get(r.r).year, ord: F1.M.raceById.get(r.r).ord, d: r.d, stop: +r.stop, lap: N(r.lap), ms: N(r.ms) }),
    fact_laps: (r) => ({ r: r.r, y: F1.M.raceById.get(r.r).year, ord: F1.M.raceById.get(r.r).ord, d: r.d, n: +r.n, best: N(r.best), med: N(r.med), mean: N(r.mean), led: +r.led }),
  };
  /* returns {status, rows} - rows are typed once and cached */
  F1.getExt = function (id) {
    const d = dash.data(id);
    if (d.status !== 'ok') return { status: d.status, rows: [] };
    if (!F1.ext[id]) F1.ext[id] = d.data.map(EXT[id]);
    return { status: 'ok', rows: F1.ext[id] };
  };

  /* ------------------------------------------------------------------ core loader */
  const CORE = ['dim_drivers', 'dim_constructors', 'dim_circuits', 'dim_status', 'fact_races', 'fact_results', 'fact_sprints', 'std_drivers', 'std_constructors'];
  F1.CORE = CORE;
  F1.loadCore = function () {
    const st = CORE.map((id) => dash.data(id));
    const bad = st.find((s) => s.status === 'error' || s.status === 'missing' || s.status === 'declined' || s.status === 'connect');
    if (bad) return { status: 'error' };
    if (st.some((s) => s.status !== 'ok')) return { status: 'loading' };
    if (!F1.M) {
      const t0 = performance.now();
      F1.M = F1.build({
        drivers: st[0].data, cons: st[1].data, circuits: st[2].data, status: st[3].data, races: st[4].data,
        results: st[5].data, sprints: st[6].data, stdD: st[7].data, stdC: st[8].data,
      });
      F1.buildMs = performance.now() - t0;
      F1.resetState();
    }
    return { status: 'ok' };
  };
})();
