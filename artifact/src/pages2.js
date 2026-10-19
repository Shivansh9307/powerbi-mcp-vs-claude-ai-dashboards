/* F1 Evolution - pages: Race & Circuit Explorer, Qualifying & Race Performance, Pit Stop Analysis */
(function () {
  'use strict';
  const F1 = window.F1, ui = F1.ui, h = ui.h, fmt = F1.fmt, charts = F1.charts, DEF = F1.DEF;
  const sgColor = ['#2FC79A', '#56B4E9', '#E69F00', '#CC79A7', '#B6BDC9', '#8FA1FF', '#4a5362'];
  const select = (label, options, value, onChange) =>
    h('label', { class: 'tb-group' }, h('span', { class: 'tb-l' }, label),
      h('select', { class: 'sel-in', 'aria-label': label, onchange: (e) => onChange(e.target.value) }, options.map((o) => h('option', { value: o.v, selected: String(o.v) === String(value) ? true : null, disabled: o.disabled ? true : null }, o.l))));
  const sgPill = (s) => h('span', null, h('i', { class: 'sw', style: { background: sgColor[s] } }), F1.SG[s]);
  const mean = (a) => (a.length ? d3.mean(a) : null);

  /* ================================================================== RACE & CIRCUIT EXPLORER */
  function candidates() {
    const rows = F1.rows(F1.state), set = new Set();
    rows.forEach((x) => { if (x.s !== 6) set.add(x.r); });
    return F1.M.races.filter((r) => set.has(r.id));
  }

  function classification(race, laps) {
    const M = F1.M, s = F1.state, rows = (M.resByRace.get(race.id) || []).slice();
    const lapMap = new Map(); if (laps) laps.forEach((l) => { if (l.r === race.id) lapMap.set(l.d, l); });
    const data = rows.map((x) => { const l = lapMap.get(x.d); return Object.assign({ gain: x.g >= 1 && x.p != null ? x.g - x.p : null, best: l ? l.best : null, med: l ? l.med : null, led: l ? l.led : null, hasLap: !!l }, x); });
    return ui.table({
      id: 'tbl-classification', cols: [
        { key: 'o', label: 'Order', num: true, w: '56px', def: 'positionOrder: the full finishing order including retirements (unique within the race).' },
        { key: 'p', label: 'Class.', num: true, fmt: (v) => (v == null ? '—' : v), def: 'Official classified position. Blank = not classified (retired, disqualified, did not start).' },
        { key: 'drv', label: 'Driver', val: (r) => F1.name.driver(r.d) }, { key: 'team', label: 'Constructor', val: (r) => F1.name.cons(r.c) },
        { key: 'g', label: 'Grid', num: true, fmt: (v) => (v == null ? '—' : v === 0 ? 'PL' : v), def: 'Race-grid slot. PL = recorded as 0 (pit lane or slot not recorded); — = missing.' },
        { key: 'l', label: 'Laps', num: true, fmt: (v) => (v == null ? '—' : v) },
        { key: 's', label: 'Outcome', fmt: (v) => sgPill(v), def: 'Status group mapped from statusId.' },
        { key: 'status', label: 'Detail', val: (r) => { const t = (M.status.get(String(r.si)) || {}).status; return t === 'Finished' ? '' : t || null; }, cls: 'mut' },
        { key: 'pt', label: 'Pts', num: true, fmt: fmt.pts, def: DEF.pts }, { key: 'gain', label: 'Places gained', num: true, fmt: fmt.signed, def: DEF.gain },
        { key: 'fr', label: 'Fastest-lap rank', num: true, fmt: (v) => (v == null ? '—' : v), def: 'Stored fastest-lap rank; only present in part of the data.' },
        { key: 'best', label: 'Best lap', num: true, fmt: fmt.lap, def: 'Fastest timed lap (lap_times). Blank = no lap data (lap times start in 1982 in this dataset).' },
        { key: 'med', label: 'Median lap', num: true, fmt: fmt.lap }, { key: 'led', label: 'Led', num: true, fmt: (v) => (v == null ? '—' : v), def: 'Laps spent in position 1 (lap_times).' },
      ], rows: data, search: (r) => `${F1.name.driver(r.d)} ${F1.name.cons(r.c)}`, placeholder: 'Search driver or team…', sort: { key: 'o', dir: 'asc' }, maxH: '520px', limit: 60,
      isSel: (r) => r.d === s.driver || r.c === s.cons, onRow: (r) => F1.pick({ driver: r.d }),
    });
  }

  function raceCharts(race) {
    const rows = (F1.M.resByRace.get(race.id) || []).filter((x) => x.s !== 6 && x.g >= 1 && x.p != null);
    const code = (d) => F1.M.drivers.get(d).code || F1.name.driver(d).split(' ').pop().slice(0, 3).toUpperCase();
    const scatter = F1.chartCard({ title: 'Grid vs finish', src: 'fact_results', def: DEF.gain, note: 'On the dashed line a car finished where it started. Below it (blue) = gained places; above it (orange) = lost places. classified starters with a recorded grid slot only.' }, (host, setTitle) => {
      const mx = d3.max(rows, (x) => Math.max(x.g, x.p)) || 20, up = rows.filter((x) => x.g > x.p).length;
      if (rows.length) setTitle(`${up} of ${rows.length} classified drivers finished ahead of their grid slot`);
      charts.scatter(host, {
        points: rows.map((x) => ({ x: x.g, y: x.p, label: code(x.d), color: x.g > x.p ? ui.C.hi : x.g < x.p ? ui.C.cmp : ui.C.soft, tip: ui.tipBody(F1.name.driver(x.d), [['Grid', 'P' + x.g], ['Finish', 'P' + x.p], ['Change', fmt.signed(x.g - x.p)], ['Team', F1.name.cons(x.c)]]) })),
        xd: [0, mx + 1], yd: [0, mx + 1], invertY: true, diag: true, xLabel: 'Grid slot', yLabel: 'Finish position', height: 340, showLabels: true, onClick: (p) => null, aria: 'Grid versus finish scatter',
      });
    });
    const gained = F1.chartCard({ title: 'Positions gained', src: 'fact_results', def: DEF.gain, note: 'Grid minus classified finish per driver, best to worst.' }, (host, setTitle) => {
      const data = rows.map((x) => ({ k: x.d, label: code(x.d), v: x.g - x.p, color: x.g - x.p >= 0 ? ui.C.hi : ui.C.cmp, tip: [['Grid → finish', `P${x.g} → P${x.p}`], ['Team', F1.name.cons(x.c)]] })).sort((a, b) => b.v - a.v);
      if (data.length > 1) setTitle(`${F1.name.driver(data[0].k)} gained most (${fmt.signed(data[0].v)}); ${F1.name.driver(data[data.length - 1].k)} lost most (${fmt.signed(data[data.length - 1].v)})`);
      charts.columns(host, { data, height: 340, name: 'Places gained', yTitle: 'Places gained (grid − finish)', xTitle: 'Driver', y: { fmt: d3.format('+d') }, valFmt: fmt.signed, tickEvery: 1, aria: 'Positions gained by driver' });
    });
    return h('div', { class: 'row r2' }, scatter, gained);
  }

  function standingsAfter(race) {
    const M = F1.M, d = (M.stdD.get(race.id) || []).slice().sort((a, b) => (a.po ?? 99) - (b.po ?? 99) || b.pt - a.pt).slice(0, 10);
    const c = (M.stdC.get(race.id) || []).slice().sort((a, b) => (a.po ?? 99) - (b.po ?? 99) || b.pt - a.pt).slice(0, 8);
    const tab = (rows, nm) => ui.table({ cols: [{ key: 'po', label: '#', num: true, fmt: (v) => (v == null ? '—' : v), w: '40px' }, { key: 'n', label: 'Name', val: (r) => nm(r.k) }, { key: 'pt', label: 'Pts', num: true, fmt: fmt.pts }, { key: 'w', label: 'Wins', num: true, fmt: (v) => (v == null ? '—' : v) }], rows, sort: { key: 'po', dir: 'asc' } });
    return h('div', { class: 'row r2' },
      ui.card({ title: 'Drivers’ standings after this round', note: 'Official snapshot stored after the race.', src: 'std_drivers' }, d.length ? tab(d, F1.name.driver) : ui.empty('No standings stored for this race')),
      ui.card({ title: 'Constructors’ standings after this round', note: 'Constructors’ standings exist from 1958.', src: 'std_constructors' }, c.length ? tab(c, F1.name.cons) : ui.empty('No constructor standings for this race', race.year < 1958 ? 'The Constructors’ Championship began in 1958.' : '')));
  }

  function raceView(ps, cands) {
    const M = F1.M, s = F1.state, wrap = h('div');
    const years = [...new Set(cands.map((r) => r.year))];
    if (!years.includes(ps.year)) ps.year = years[years.length - 1];
    const inYear = cands.filter((r) => r.year === ps.year);
    let race = inYear.find((r) => r.id === ps.race) || inYear[inYear.length - 1];
    ps.race = race.id;
    const season = M.seasons.get(race.year);
    wrap.append(h('div', { class: 'chips' },
      select('Season', years.slice().reverse().map((y) => ({ v: y, l: y + (M.seasons.get(y).complete ? '' : ' (partial)') })), ps.year, (v) => { ps.year = +v; ps.race = null; F1.go(); }),
      select('Grand Prix', inYear.map((r) => ({ v: r.id, l: `R${r.round} · ${r.name}` })), race.id, (v) => { ps.race = v; F1.go(); })));
    const all = M.resByRace.get(race.id) || [], win = all.filter((x) => x.p === 1), poleRow = all.find((x) => x.g === 1 && x.s !== 6), st = all.filter((x) => x.s !== 6);
    const fl = all.find((x) => x.fr === 1);
    const a = F1.aggregate(all);
    const nameList = (xs) => xs.map((x) => F1.name.driver(x.d)).join(' & ');
    wrap.append(h('p', { class: 'headline' }, `${win.length ? nameList(win) : 'No classified winner'}${win.length && win[0].g >= 1 ? ' won from grid slot P' + win[0].g : win.length ? ' won' : ''}; ${a.dnf} of ${st.length} starters retired${poleRow ? ', and the pole-sitter ' + (poleRow.p === 1 ? 'converted it into the win' : 'did not win') : ''}.`));
    wrap.append(h('div', { class: 'kpis', 'data-source': 'fact_results fact_races' },
      ui.kpi({ label: 'Race', value: h('span', { style: { fontSize: '22px' } }, race.name), sub: `${race.date} · ${F1.name.circuit(race.circuit)}${race.laps ? ' · ' + race.laps + ' laps' : ''}` }),
      ui.kpi({ label: 'Winner', value: h('span', { style: { fontSize: '22px' } }, win.length ? nameList(win) : '—'), accent: 'red', def: DEF.wins, sub: win.length ? F1.name.cons(win[0].c) + (win.length > 1 ? ' · shared result' : '') : 'no classified winner' }),
      ui.kpi({ label: 'Pole (race grid)', value: h('span', { style: { fontSize: '22px' } }, poleRow ? F1.name.driver(poleRow.d) : '—'), def: DEF.poles, sub: poleRow ? (poleRow.p === 1 ? 'converted to a win' : poleRow.p ? 'finished P' + poleRow.p : 'did not finish') : 'grid slot 1 not recorded' }),
      ui.kpi({ label: 'Starters', value: fmt.int(st.length), sub: `${a.classified} classified · ${a.sg[0] + a.sg[1]} finished` }),
      ui.kpi({ label: 'Retirements', value: fmt.int(a.dnf), def: DEF.dnfRate, sub: `${a.sg[2]} mech · ${a.sg[3]} accident · ${a.sg[5]} other` }),
      ui.kpi({ label: 'Fastest lap (stored rank 1)', value: h('span', { style: { fontSize: '22px' } }, fl ? F1.name.driver(fl.d) : '—'), def: DEF.fl, sub: fl ? F1.name.cons(fl.c) : 'not recorded for this race' })));
    if (!season.complete && race.year === season.year) wrap.append(ui.banner('warn', h('b', null, `${race.year} is a partial season`), ` — ${season.held} of ${season.sched} races have results. Standings below are provisional.`));
    const lp = F1.getExt('fact_laps');
    wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Full classification', note: lp.status === 'ok' ? (race.nlap ? 'Lap columns come from lap_times for this race.' : 'No lap-time rows exist for this race (lap times begin in 1982 in this dataset); lap columns are blank, not zero.') : 'Lap columns load separately.', src: 'fact_results fact_laps dim_status' }, classification(race, lp.rows))));
    wrap.append(raceCharts(race));
    const spr = (M.sprints || []).filter((x) => x.r === race.id).sort((p, q) => p.o - q.o);
    if (spr.length) wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Sprint result', note: 'Sprint points are included in recorded and championship points but are not counted as Grand Prix wins.', src: 'fact_sprints' }, ui.table({
      cols: [{ key: 'o', label: 'Order', num: true }, { key: 'p', label: 'Class.', num: true, fmt: (v) => (v == null ? '—' : v) }, { key: 'd', label: 'Driver', val: (r) => F1.name.driver(r.d) }, { key: 'c', label: 'Constructor', val: (r) => F1.name.cons(r.c) }, { key: 'g', label: 'Grid', num: true, fmt: (v) => (v == null ? '—' : v) }, { key: 's', label: 'Outcome', fmt: sgPill }, { key: 'pt', label: 'Pts', num: true, fmt: fmt.pts }], rows: spr, sort: { key: 'o', dir: 'asc' },
    }))));
    wrap.append(standingsAfter(race));
    return wrap;
  }

  function circuitDirectory() {
    const M = F1.M, s = F1.state, rows = F1.rows(s).filter((x) => x.s !== 6);
    const byCi = d3.group(rows, (x) => x.ci), list = [];
    byCi.forEach((rs, ci) => {
      const c = M.circuits.get(ci), a = F1.aggregate(rs), raceIds = new Set(rs.map((x) => x.r));
      const winners = d3.rollups(rs.filter((x) => x.p === 1), (v) => v.length, (x) => x.d).sort((p, q) => q[1] - p[1]);
      const ys = rs.map((x) => x.y);
      list.push({ id: ci, name: c.name, country: c.country, y0: d3.min(ys), y1: d3.max(ys), races: raceIds.size, winners: winners.length, top: winners[0] ? `${F1.name.driver(winners[0][0])} (${winners[0][1]})` : null, topN: winners[0] ? winners[0][1] : null, conv: a.conv, dnf: a.dnfRate, poles: a.poles });
    });
    return ui.card({ title: 'Circuit directory', note: 'Every circuit that hosted a race in the selection. Click a circuit to filter the dashboard to it.', src: 'fact_results fact_races dim_circuits' }, ui.table({
      id: 'tbl-circuits', cols: [
        { key: 'name', label: 'Circuit' }, { key: 'country', label: 'Country', cls: 'mut' }, { key: 'y0', label: 'Seasons', fmt: (v, r) => (r.y0 === r.y1 ? r.y0 : `${r.y0}–${r.y1}`) },
        { key: 'races', label: 'Races', num: true, bar: true, fmt: fmt.int, def: DEF.gp }, { key: 'winners', label: 'Different winners', num: true, fmt: fmt.int },
        { key: 'top', label: 'Most wins', val: (r) => r.top, cls: 'mut' }, { key: 'conv', label: 'Pole→win', num: true, fmt: fmt.p0, def: DEF.conv + ' (needs ≥3 poles to rank)', val: (r) => (r.poles >= 3 ? r.conv : null) },
        { key: 'dnf', label: 'Retired %', num: true, fmt: fmt.p0, def: DEF.dnfRate },
      ], rows: list, search: (r) => `${r.name} ${r.country}`, placeholder: 'Search circuits or countries…', sort: { key: 'races', dir: 'desc' }, limit: 25, onRow: (r) => F1.pick({ circuit: r.id }),
    }));
  }

  function circuitView(ps) {
    const M = F1.M, s = F1.state, wrap = h('div'), ci = s.circuit, c = M.circuits.get(ci);
    const rows = F1.rows(s), a = F1.aggregate(rows.filter((x) => x.s !== 6 || true), F1.sprintRows(s));
    const raceIds = [...new Set(rows.filter((x) => x.s !== 6).map((x) => x.r))], races = raceIds.map((id) => M.raceById.get(id)).sort((p, q) => p.ord - q.ord);
    const wins = rows.filter((x) => x.p === 1), winners = new Set(wins.map((x) => x.d));
    wrap.append(h('div', { class: 'kpis', 'data-source': 'fact_results fact_races dim_circuits' },
      ui.kpi({ label: 'Circuit', value: h('span', { style: { fontSize: c.name.length > 22 ? '17px' : '22px' } }, c.name), sub: `${c.loc}, ${c.country}` }),
      ui.kpi({ label: 'Races held', value: fmt.int(races.length), def: DEF.gp, sub: races.length ? `${races[0].year}–${races[races.length - 1].year}` : '' }),
      ui.kpi({ label: 'Different winners', value: fmt.int(winners.size), sub: 'drivers with ≥1 win here' }),
      ui.kpi({ label: 'Pole → win', value: fmt.p0(a.conv), def: DEF.conv, sub: `${a.polesWon} of ${a.poles} poles` }),
      ui.kpi({ label: 'DNF rate', value: fmt.p1(a.dnfRate), def: DEF.dnfRate, sub: `mech ${fmt.p0(a.mechRate)} · accident ${fmt.p0(a.accRate)}` }),
      ui.kpi({ label: 'Avg winner grid', value: fmt.d1(mean(wins.filter((x) => x.g >= 1).map((x) => x.g))), def: 'Mean race-grid slot of winners with a recorded slot ≥ 1.', sub: 'lower = winners start up front' })));
    const dl = F1.leaderboard('driver', s, 'driver').filter((x) => x.wins).sort((p, q) => q.wins - p.wins).slice(0, 10);
    const cl = F1.leaderboard('cons', s, 'cons').filter((x) => x.wins).sort((p, q) => q.wins - p.wins).slice(0, 10);
    wrap.append(h('div', { class: 'row r2' },
      F1.chartCard({ title: 'Winners by driver', src: 'fact_results', note: 'Wins at this circuit in the selected seasons. Blue = leader, red = selected.' }, (host, setTitle) => { if (dl[0]) setTitle(`${dl[0].name} has won most here (${dl[0].wins})`); charts.hbars(host, { items: dl.map((x, i) => ({ id: x.id, label: x.name, value: x.wins, text: x.wins, selected: x.id === s.driver, hi: i === 0 })), onClick: (it) => F1.pick({ driver: it.id === s.driver ? null : it.id }) }); }),
      F1.chartCard({ title: 'Winners by constructor', src: 'fact_results', note: 'Win credits per constructor at this circuit.' }, (host, setTitle) => { if (cl[0]) setTitle(`${cl[0].name} leads here with ${cl[0].wins} wins`); charts.hbars(host, { items: cl.map((x, i) => ({ id: x.id, label: x.name, value: x.wins, text: x.wins, selected: x.id === s.cons, hi: i === 0 })), onClick: (it) => F1.pick({ cons: it.id === s.cons ? null : it.id }) }); })));
    const perRace = races.map((r) => { const all = M.resByRace.get(r.id) || [], a2 = F1.aggregate(all); return { r, a2, w: all.find((x) => x.p === 1), pole: all.find((x) => x.g === 1 && x.s !== 6) }; });
    wrap.append(h('div', { class: 'row r2' },
      F1.chartCard({ title: 'Winner’s grid slot by year', src: 'fact_results', def: 'Race-grid slot of the winner each year (1 = won from pole). Missing slots are skipped, never plotted as zero.', note: 'Higher up the chart = winners starting nearer the front.' }, (host, setTitle) => {
        const data = perRace.filter((p) => p.w && p.w.g >= 1).map((p) => [p.r.year, p.w.g]);
        if (data.length) { const worst = data.reduce((a, b) => (b[1] > a[1] ? b : a)); setTitle(`${data.filter((p) => p[1] === 1).length} of ${data.length} winners here started from pole`); charts.line(host, { series: [{ name: 'Winner grid slot', data, color: ui.C.hi }], height: 250, yTitle: 'Winner’s grid slot', xTitle: 'Season', annotate: [{ x: worst[0], y: worst[1], text: `P${worst[1]} (${worst[0]})`, below: true }], y: { fmt: (v) => 'P' + v, invert: true, domain: [1, Math.max(6, d3.max(data, (p) => p[1]))] }, onClick: (yr) => { ps.year = yr; const r = races.find((x) => x.year === yr); ps.race = r.id; ps.view = 'race'; F1.go(); }, aria: 'Winner grid slot by year' }); }
      }),
      F1.chartCard({ title: 'Retirement rate by year', src: 'fact_results', def: DEF.dnfRate, note: 'Mechanical + accident + other retirements per start at this circuit.' }, (host, setTitle) => {
        const dn = perRace.map((p) => ({ y: p.r.year, v: p.a2.dnfRate })).filter((x) => x.v != null), pk = perRace.reduce((a, b) => (b.a2.dnfRate > a.a2.dnfRate ? b : a), perRace[0]);
        if (dn.length >= 6) { const A = dn.slice(0, 3), B = dn.slice(-3), av = (xs) => d3.mean(xs, (x) => x.v); setTitle(ui.changeTitle('Retirements here', { x: `${A[0].y}–${A[2].y}`, v: av(A) }, { x: `${B[0].y}–${B[2].y}`, v: av(B) }, fmt.p0)); }
        charts.columns(host, { data: perRace.map((p) => ({ k: p.r.id, label: '' + p.r.year, v: p.a2.dnfRate, partial: !M.seasons.get(p.r.year).complete })), height: 250, yTitle: 'Share of starts retired', xTitle: 'Season', annotate: pk ? [{ k: pk.r.id, text: `Peak ${fmt.p0(pk.a2.dnfRate)} (${pk.r.year})` }] : [], y: { fmt: fmt.p0 }, valFmt: fmt.p1, name: 'Retired', onClick: (d) => { const r = M.raceById.get(d.k); ps.year = r.year; ps.race = r.id; ps.view = 'race'; F1.go(); }, aria: 'DNF rate by year' });
      })));
    wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Races at this circuit', note: 'Race-level facts for the whole field. Click a row to open the race.', src: 'fact_results fact_races' }, ui.table({
      id: 'tbl-circuit-races', cols: [
        { key: 'year', label: 'Season', num: true, val: (r) => r.r.year }, { key: 'name', label: 'Grand Prix', val: (r) => r.r.name },
        { key: 'w', label: 'Winner', val: (r) => (r.w ? F1.name.driver(r.w.d) : null) }, { key: 'wc', label: 'Constructor', val: (r) => (r.w ? F1.name.cons(r.w.c) : null) },
        { key: 'wg', label: 'Win grid', num: true, val: (r) => (r.w && r.w.g >= 1 ? r.w.g : null) }, { key: 'pole', label: 'Pole (grid 1)', val: (r) => (r.pole ? F1.name.driver(r.pole.d) : null) },
        { key: 'st', label: 'Starters', num: true, val: (r) => r.a2.starts, fmt: fmt.int }, { key: 'dnf', label: 'Retired', num: true, val: (r) => r.a2.dnf, fmt: fmt.int },
      ], rows: perRace, sort: { key: 'year', dir: 'desc' }, search: (r) => `${r.r.year} ${r.r.name} ${r.w ? F1.name.driver(r.w.d) : ''}`, placeholder: 'Search year or winner…', maxH: '420px',
      onRow: (r) => { ps.year = r.r.year; ps.race = r.r.id; ps.view = 'race'; F1.go(); },
    }))));
    return wrap;
  }

  F1.pages.races = {
    needs: ['fact_laps'],
    render() {
      const ps = (F1.ps.races = F1.ps.races || {});
      ps.view = ps.view || 'race';
      const s = F1.state, wrap = h('div'), cands = candidates();
      const title = ps.view === 'circuit' ? (s.circuit ? F1.name.circuit(s.circuit) + ', ' + F1.rangeLabel(s) : 'Circuits, ' + F1.rangeLabel(s)) : 'Races, ' + F1.rangeLabel(s);
      wrap.append(F1.pageHead('Race & Circuit Explorer', title, 'Drill from season to race to driver: pick a season and Grand Prix for the full classification, or switch to the circuit view for winners and track-specific rates.'));
      wrap.append(h('div', { class: 'chips' }, ui.seg({ label: 'View', value: ps.view, options: [{ id: 'race', label: 'Race detail' }, { id: 'circuit', label: 'Circuit view' }], onChange: (v) => { ps.view = v; F1.go(); } })));
      if (!cands.length) { wrap.append(ui.empty('No races match these filters', 'Clear the driver / constructor / circuit filter or widen the season range.')); return wrap; }
      if (ps.view === 'circuit') wrap.append(s.circuit ? circuitView(ps) : circuitDirectory());
      else wrap.append(raceView(ps, cands));
      return wrap;
    },
  };

  /* ================================================================== QUALIFYING & RACE PERFORMANCE */
  function gridSlotAnalysis() {
    const s = F1.state, rows = F1.rows(s).filter((x) => x.s !== 6 && x.g >= 1 && x.g <= 20);
    const by = F1.groupAgg(rows, (x) => x.g);
    const slots = d3.range(1, 21).map((g) => ({ g, a: by.get(g) })).filter((x) => x.a && x.a.starts >= 5);
    const conv = F1.chartCard({ title: 'Win rate by starting slot', src: 'fact_results', def: 'Wins ÷ starts from that grid slot (slots with ≥5 starts). Uses the race grid, not qualifying order.', note: 'How much of the race result is decided on the grid. Blue = pole.' }, (host, setTitle) => {
      const w = (g) => { const x = slots.find((q) => q.g === g); return x ? x.a.winPct : null; };
      if (w(1) != null) setTitle(`A pole-sitter wins ${fmt.p0(w(1))} of the time${w(5) != null ? `; the fifth-placed starter wins ${fmt.p1(w(5))}` : ''}`);
      charts.columns(host, { data: slots.map(({ g, a }) => ({ k: g, label: '' + g, v: a.winPct, tip: [['Wins / starts', `${a.wins} / ${fmt.int(a.starts)}`], ['Podium rate', fmt.p1(a.podPct)]] })), height: 250, yTitle: 'Share of starts won', xTitle: 'Starting slot (grid position)', highlight: (d) => d.k === 1, annotate: slots.length ? [{ k: slots[0].g, text: fmt.p0(slots[0].a.winPct) }] : [], y: { fmt: fmt.p0 }, valFmt: fmt.p1, name: 'Win rate', tickEvery: 1, aria: 'Win rate by grid slot' });
    });
    const outcome = F1.chartCard({ title: 'What happens from each slot', src: 'fact_results dim_status', def: 'Share of starts from each grid slot ending in each status group.', note: 'Retired = mechanical, accident or other retirement, as a share of starts from that slot.' }, (host, setTitle) => {
      const ret = (a) => (a.sg[2] + a.sg[3] + a.sg[5]) / a.starts, A = slots[0], Z = slots[slots.length - 1];
      if (A && Z && A !== Z) setTitle(`A car starting ${Z.g === 20 ? 'last' : 'P' + Z.g} retires ${fmt.p0(ret(Z.a))} of the time, against ${fmt.p0(ret(A.a))} from pole`);
      charts.columns(host, { data: slots.map(({ g, a }) => ({ k: g, label: '' + g, stack: { lead: a.sg[0] / a.starts, lap: (a.sg[1] + a.sg[4]) / a.starts, ret: ret(a) } })), stacks: [{ key: 'lead', name: 'Finished on lead lap', color: ui.C.base }, { key: 'lap', name: 'Lapped / disqualified', color: ui.C.soft }, { key: 'ret', name: 'Retired', color: ui.C.cmp }], height: 250, yTitle: 'Share of starts', xTitle: 'Starting slot (grid position)', y: { fmt: fmt.p0, domain: [0, 1] }, tickEvery: 1, aria: 'Outcome by grid slot' });
    });
    return h('div', { class: 'row r2' }, conv, outcome);
  }

  function poleConversion() {
    const s = F1.state, ser = F1.seasonSeries(s).filter((r) => r.a && r.a.poles);
    return F1.chartCard({ title: 'Pole-to-win conversion by season', src: 'fact_results', def: DEF.conv, note: 'Share of race-grid poles converted to wins. Seasons with few poles are noisy; hover for counts.' }, (host, setTitle) => {
      if (!ser.length) { host.replaceChildren(ui.empty('No poles in this selection')); return; }
      const partial = F1.partialYearsIn(s)[0], dd = ser.map((r) => [r.year, r.a.conv]), pool = (xs) => d3.sum(xs, (r) => r.a.polesWon) / d3.sum(xs, (r) => r.a.poles);
      if (ser.length >= 6) { const A = ser.slice(0, 3), B = ser.filter((r) => r.season.complete).slice(-3); if (B.length === 3) setTitle(ui.changeTitle('A pole’s chance of winning', { x: `${A[0].year}–${A[2].year}`, v: pool(A) }, { x: `${B[0].year}–${B[2].year}`, v: pool(B) }, fmt.p0)); }
      charts.line(host, { series: [{ name: 'Pole → win', data: dd, color: ui.C.hi, fmt: fmt.p0 }], height: 270, yTitle: 'Poles converted to wins', xTitle: 'Season', annotate: ui.autoNotes(ser.filter((r) => r.season.complete).map((r) => [r.year, r.a.conv]), fmt.p0, { last: true }), y: { fmt: fmt.p0, domain: [0, 1] }, partial: partial ? { from: partial.year } : null, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Pole to win conversion' });
    });
  }

  function positionChange() {
    const s = F1.state, rows = F1.rows(s).filter((x) => x.s !== 6 && x.g >= 1 && x.p != null);
    return F1.chartCard({ title: 'Position change distribution', src: 'fact_results', def: DEF.gain + ' Bars show the count of classified starts for each change (clipped to ±12).', note: `${fmt.int(rows.length)} classified starts with a recorded grid slot.` }, (host, setTitle) => {
      if (rows.length < 10) { host.replaceChildren(ui.empty('Too few classified starts')); return; }
      const cnt = d3.rollup(rows, (v) => v.length, (x) => Math.max(-12, Math.min(12, x.g - x.p)));
      const data = d3.range(-12, 13).map((k) => ({ k, label: (k > 0 ? '+' : '') + (k === -12 ? '≤−12' : k === 12 ? '≥12' : k), v: cnt.get(k) || 0, color: k > 0 ? ui.C.hi : k < 0 ? ui.C.cmp : ui.C.soft }));
      const ch = rows.map((x) => x.g - x.p), med = d3.median(ch), gainShare = ch.filter((v) => v > 0).length / ch.length, lossShare = ch.filter((v) => v < 0).length / ch.length;
      setTitle(`${fmt.p0(gainShare)} of classified starters finished ahead of their grid slot, ${fmt.p0(lossShare)} behind`);
      charts.columns(host, { data, height: 270, name: 'Classified starts', yTitle: 'Classified starts', xTitle: 'Places gained (grid − finish); blue = gained, orange = lost', y: { fmt: d3.format(',') }, tickEvery: 2, aria: 'Position change distribution' });
    });
  }

  function qualiTable(q, cov) {
    const M = F1.M, s = F1.state;
    const rows = q.filter((x) => x.y >= s.y0 && x.y <= s.y1 && (!s.driver || x.d === s.driver) && (!s.cons || x.c === s.cons) && (!s.circuit || M.raceById.get(x.r).circuit === s.circuit));
    const byRace = d3.group(rows, (x) => x.r), best = (x) => { const v = [x.q1, x.q2, x.q3].filter((t) => t != null); return v.length ? Math.min(...v) : null; };
    const fastest = new Map(); byRace.forEach((rs, r) => fastest.set(r, d3.min(rs, best)));
    const hasQ3 = new Map(); byRace.forEach((rs, r) => hasQ3.set(r, rs.some((x) => x.q3 != null)));
    const res = new Map(); F1.rows(Object.assign({}, s, { driver: null, cons: null }), null).forEach((x) => { if (x.s !== 6) res.set(x.r + '|' + x.d, x); });
    const g = d3.group(rows, (x) => x.d), list = [];
    g.forEach((rs, d) => {
      const withPos = rs.filter((x) => x.p != null), gaps = rs.map((x) => { const b = best(x), f = fastest.get(x.r); return b && f ? b / f - 1 : null; }).filter((v) => v != null);
      const q3rs = rs.filter((x) => hasQ3.get(x.r));
      const diff = rs.map((x) => { const r = res.get(x.r + '|' + x.d); return r && r.p != null && x.p != null ? x.p - r.p : null; }).filter((v) => v != null);
      list.push({ d, name: F1.name.driver(d), n: rs.length, poles: rs.filter((x) => x.p === 1).length, front: rs.filter((x) => x.p != null && x.p <= 2).length, avgPos: mean(withPos.map((x) => x.p)), q3: q3rs.length ? q3rs.filter((x) => x.q3 != null).length / q3rs.length : null, q3n: q3rs.length, gap: gaps.length ? mean(gaps) : null, race: diff.length ? mean(diff) : null, y0: d3.min(rs, (x) => x.y), y1: d3.max(rs, (x) => x.y) });
    });
    return ui.table({
      id: 'tbl-quali', cols: [
        { key: 'name', label: 'Driver' }, { key: 'y0', label: 'Seasons', fmt: (v, r) => (r.y0 === r.y1 ? r.y0 : `${r.y0}–${r.y1}`) },
        { key: 'n', label: 'Sessions', num: true, fmt: fmt.int, def: 'Qualifying rows (driver × race) in the qualifying table. Early seasons are only partly covered — see the coverage note.' },
        { key: 'poles', label: 'Quali poles', num: true, bar: true, fmt: fmt.int, def: 'Qualifying position 1 in the qualifying table (differs from race-grid poles when penalties apply).' },
        { key: 'front', label: 'Front rows', num: true, fmt: fmt.int, def: 'Qualifying position 1–2.' },
        { key: 'avgPos', label: 'Avg quali pos', num: true, fmt: fmt.d1 },
        { key: 'q3', label: 'Q3 rate', num: true, fmt: fmt.p0, def: 'Share of sessions reaching Q3, counted only in races where any driver set a Q3 time (Q3 did not exist in earlier formats).', val: (r) => (r.q3n >= 8 ? r.q3 : null) },
        { key: 'gap', label: 'Gap to fastest', num: true, fmt: (v) => (v == null ? '—' : (v * 100).toFixed(2) + '%'), def: 'Mean of (driver’s best qualifying lap ÷ fastest qualifying lap of that session − 1). Sessions are not directly comparable across conditions.' },
        { key: 'race', label: 'Race vs quali', num: true, fmt: fmt.signed, def: 'Qualifying position minus classified race finish, averaged. Positive = finished ahead of where they qualified.' },
      ], rows: list, search: (r) => r.name, placeholder: 'Search drivers…', sort: { key: 'poles', dir: 'desc' }, limit: 25, isSel: (r) => r.d === s.driver, onRow: (r) => F1.pick({ driver: r.d }),
    });
  }

  function lapModule(lp) {
    const M = F1.M, s = F1.state, laps = lp.rows.filter((x) => x.y >= s.y0 && x.y <= s.y1 && (!s.driver || x.d === s.driver) && (!s.circuit || M.raceById.get(x.r).circuit === s.circuit));
    const cmap = new Map(); F1.rows(Object.assign({}, s, { driver: null, cons: null }), null).forEach((x) => { if (x.s !== 6) cmap.set(x.r + '|' + x.d, x.c); });
    const lf = laps.filter((x) => !s.cons || cmap.get(x.r + '|' + x.d) === s.cons);
    const led = d3.rollups(lf, (v) => d3.sum(v, (x) => x.led), (x) => x.d).sort((p, q) => q[1] - p[1]).filter((x) => x[1] > 0).slice(0, 10);
    const races = new Set(lf.map((x) => x.r));
    return h('div', { class: 'row r2' },
      F1.chartCard({ title: 'Laps led', src: 'fact_laps', def: 'Laps spent in position 1 according to lap_times (timed laps). Only seasons with lap data are counted.', note: lf.length ? `${races.size} races with lap data in the selection.` : 'No lap-time data in the selection.' }, (host, setTitle) => {
        if (!led.length) { host.replaceChildren(ui.empty('No lap data here', 'Lap times start in 1982 in this dataset; missing laps are not treated as zero.')); return; }
        setTitle(`${F1.name.driver(led[0][0])} has led the most laps (${fmt.int(led[0][1])})`);
        charts.hbars(host, { items: led.map(([d, v], i) => ({ id: d, label: F1.name.driver(d), value: v, text: fmt.int(v), selected: d === s.driver, hi: i === 0 })), onClick: (it) => F1.pick({ driver: it.id === s.driver ? null : it.id }) });
      }),
      F1.chartCard({ title: 'Race pace: field median lap by season', src: 'fact_races fact_laps', def: 'Median of all timed laps in each race, averaged over the season’s races at the selected circuit(s). Across different circuits, lap times are not comparable — pick a circuit in the toolbar for a like-for-like trend.', note: s.circuit ? 'Like-for-like: one circuit.' : 'Select a circuit to enable like-for-like pace.' }, (host, setTitle) => {
        if (!s.circuit) { host.replaceChildren(ui.empty('Pick a circuit to compare pace over time', 'Lap times differ by track; mixing circuits would mislead.')); return; }
        const rs = M.races.filter((r) => r.circuit === s.circuit && r.year >= s.y0 && r.year <= s.y1 && r.lapmed != null);
        if (!rs.length) { host.replaceChildren(ui.empty('No lap data at this circuit in range')); return; }
        if (rs.length >= 2) setTitle(ui.changeTitle('The median race lap', { x: rs[0].year, v: rs[0].lapmed }, { x: rs[rs.length - 1].year, v: rs[rs.length - 1].lapmed }, fmt.lap));
        charts.line(host, { series: [{ name: 'Median lap', data: rs.map((r) => [r.year, r.lapmed]), color: ui.C.hi, fmt: fmt.lap }, { name: 'Fastest lap', data: rs.map((r) => [r.year, r.lapbest]), color: ui.C.cmp, fmt: fmt.lap }], height: 260, yTitle: 'Lap time (m:ss)', xTitle: 'Season', y: { fmt: fmt.lap, zero: false }, endLabels: true, aria: 'Lap time trend at one circuit' });
      }));
  }

  function qualiHeadline() {
    const by = F1.groupAgg(F1.rows(F1.state).filter((x) => x.s !== 6 && x.g >= 1 && x.g <= 20), (x) => x.g), r = (g) => (by.get(g) && by.get(g).starts >= 5 ? by.get(g).winPct : null);
    if (r(1) == null) return null;
    return `A car starting from pole wins ${fmt.p0(r(1))} of the time${r(5) != null ? `; from fifth that falls to ${fmt.p1(r(5))}` : ''}${r(10) != null ? ` and from tenth to ${fmt.p1(r(10))}` : ''}.`;
  }
  F1.pages.quali = {
    needs: ['fact_quali', 'fact_laps'],
    render() {
      const s = F1.state, M = F1.M, wrap = h('div');
      F1.nextHeadline = qualiHeadline();
      wrap.append(F1.pageHead('Qualifying & Race Performance', 'Starting grid and race performance, ' + F1.dynTitle(), 'How much the starting grid decides the race, how places change between lights-out and the flag, and what the qualifying and lap tables add where they exist.'));
      const rows = F1.rows(s).filter((x) => x.s !== 6);
      if (!rows.length) { wrap.append(ui.empty('No race starts match these filters')); return wrap; }
      const gs = rows.filter((x) => x.g === 0).length;
      if (gs) wrap.append(ui.banner('info', `${fmt.int(gs)} starts have grid = 0 (pit lane or slot not recorded) and ${fmt.int(rows.filter((x) => x.g == null).length)} have no grid value; both are excluded from grid-based rates rather than treated as pole or last.`));
      wrap.append(gridSlotAnalysis());
      wrap.append(h('div', { class: 'row r2' }, poleConversion(), positionChange()));
      wrap.append(h('div', { class: 'sec-h' }, 'Qualifying records'));
      const q = F1.getExt('fact_quali');
      if (q.status === 'loading') wrap.append(F1.hostLoading(5));
      else if (q.status !== 'ok') wrap.append(ui.empty('Qualifying table did not load'));
      else {
        const rs = M.races.filter((r) => r.done && r.year >= s.y0 && r.year <= s.y1 && (!s.circuit || r.circuit === s.circuit)), withQ = rs.filter((r) => r.nq > 0);
        wrap.append(ui.banner(withQ.length === rs.length ? 'info' : 'warn', h('b', null, 'Qualifying coverage: '), `${withQ.length} of ${rs.length} races in the selection have qualifying rows (${rs.length ? fmt.p0(withQ.length / rs.length) : '—'}). `, 'The qualifying table starts in 1994 and is only partial for several early seasons; races without rows are blank, not zero. Sessions per race are as stored (all drivers with a row).'));
        wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Qualifying records', note: 'Per driver within the filters. Click a row to filter to that driver.', src: 'fact_quali fact_results' }, withQ.length ? qualiTable(q.rows, withQ) : ui.empty('No qualifying data in this selection', 'Try a season range from 1994 onwards.'))));
      }
      wrap.append(h('div', { class: 'sec-h' }, 'Lap-time module'));
      const lp = F1.getExt('fact_laps');
      if (lp.status === 'loading') wrap.append(F1.hostLoading(4));
      else if (lp.status !== 'ok') wrap.append(ui.empty('Lap table did not load'));
      else wrap.append(lapModule(lp));
      return wrap;
    },
  };

  /* ================================================================== PIT STOP ANALYSIS */
  const TYPICAL_MS = 60000;
  F1.pages.pits = {
    needs: ['fact_pits'],
    render() {
      const M = F1.M, s = F1.state, wrap = h('div'), ps = (F1.ps.pits = Object.assign({ m: 'median' }, F1.ps.pits));
      const head = F1.pageHead('Pit Stop Analysis', 'Pit stops, ' + F1.dynTitle(), 'Stop counts and pit-lane times as recorded in the pit-stop table. The recorded duration is the time spent in the pit lane (entry to exit), not the stationary tyre-change time. Associations on this page describe the data; they do not show that any stop strategy caused a result.');
      wrap.append(head);
      const p = F1.getExt('fact_pits');
      if (p.status === 'loading') { wrap.append(F1.hostLoading(6)); return wrap; }
      if (p.status !== 'ok') { wrap.append(ui.empty('Pit-stop table did not load')); return wrap; }
      const cmap = new Map(); F1.rows(Object.assign({}, s, { driver: null, cons: null }), null).forEach((x) => { if (x.s !== 6) cmap.set(x.r + '|' + x.d, x.c); });
      const stops = p.rows.filter((x) => x.y >= s.y0 && x.y <= s.y1 && (!s.driver || x.d === s.driver) && (!s.circuit || M.raceById.get(x.r).circuit === s.circuit) && (!s.cons || cmap.get(x.r + '|' + x.d) === s.cons));
      const yrs = [...new Set(M.races.filter((r) => r.npit > 0).map((r) => r.year))];
      const cov = M.races.filter((r) => r.done && r.year >= s.y0 && r.year <= s.y1 && (!s.circuit || r.circuit === s.circuit)), covWith = cov.filter((r) => r.npit > 0);
      wrap.append(ui.banner(covWith.length === cov.length ? 'info' : 'warn', h('b', null, 'Scope: '), `Pit-stop rows exist for seasons ${d3.min(yrs)}–${d3.max(yrs)}; ${covWith.length} of ${cov.length} races in this selection have any. `, `The recorded duration is pit-lane time (entry to exit), not the few seconds a car is stationary — stationary times are not in this dataset, so a figure like 1.99 s cannot appear here. “Typical” stops are ≤ ${TYPICAL_MS / 1000} s; longer ones (repairs, red-flag stops, penalties) are counted separately, never dropped.`));
      if (!stops.length) {
        wrap.append(ui.empty('No pit-stop rows in this selection', 'Pit stops are recorded from ' + d3.min(yrs) + '. Showing retirements by cause instead.'));
        const a = F1.aggregate(F1.rows(s));
        wrap.append(h('div', { class: 'row' }, F1.chartCard({ title: 'Fallback: how starts ended', src: 'fact_results' }, (host) => charts.hbars(host, { items: [0, 1, 2, 3, 4, 5].map((i) => ({ id: i, label: F1.SG[i], value: a.sg[i], text: fmt.int(a.sg[i]) })) }))));
        return wrap;
      }
      const ok = stops.filter((x) => x.ms != null), typ = ok.filter((x) => x.ms <= TYPICAL_MS), ext = ok.filter((x) => x.ms > TYPICAL_MS), missing = stops.length - ok.length;
      const raceCnt = new Set(stops.map((x) => x.r)).size, carRace = new Set(stops.map((x) => x.r + '|' + x.d)).size;
      F1.setHeadline(head, `Time in the pit lane has a median of ${fmt.sec(d3.median(typ, (x) => x.ms))} across ${fmt.int(typ.length)} timed stops; ${fmt.int(ext.length)} extended stops (> ${TYPICAL_MS / 1000} s) are reported separately.`);
      const raceMed = d3.rollup(p.rows.filter((x) => x.ms != null && x.ms <= TYPICAL_MS), (v) => d3.median(v, (x) => x.ms), (x) => x.r);
      const fastest = typ.reduce((m, x) => (!m || x.ms < m.ms ? x : m), null);
      wrap.append(h('div', { class: 'kpis', 'data-source': 'fact_pits fact_races' },
        ui.kpi({ label: 'Pit stops', value: fmt.int(stops.length), sub: `${raceCnt} races · ${missing} without a duration`, def: 'Rows in the pit-stop table in the selection.' }),
        ui.kpi({ label: 'Median pit-lane time', value: fmt.sec(d3.median(typ, (x) => x.ms)), accent: 'red', def: `Median time in the pit lane (entry to exit) of stops ≤ ${TYPICAL_MS / 1000}s, robust to outliers. This is NOT the stationary tyre-change time.`, sub: `${fmt.int(typ.length)} typical stops` }),
        ui.kpi({ label: 'Fastest pit-lane time', value: fastest ? fmt.sec(fastest.ms) : '—', def: 'Shortest recorded time in the pit lane (entry to exit). It is a raw minimum and can be an outlier — see the gap to the race median in the table below. It is not a stationary time.', sub: fastest ? `${F1.name.driver(fastest.d)}, ${M.raceById.get(fastest.r).name} ${M.raceById.get(fastest.r).year} · ${fmt.signed(-(raceMed.get(fastest.r) - fastest.ms) / 1000)} s vs race median` : '' }),
        ui.kpi({ label: 'Extended stops', value: fmt.int(ext.length), def: `Stops longer than ${TYPICAL_MS / 1000}s — typically repairs, red flags or penalties.`, sub: ok.length ? fmt.p1(ext.length / ok.length) + ' of timed stops' : '' }),
        ui.kpi({ label: 'Stops per car', value: fmt.d2(stops.length / carRace), def: 'Pit stops ÷ distinct (race, driver) pairs that made at least one stop. Cars that never stopped are not in the table, so this is conditional on stopping.', sub: 'among cars that stopped' })));
      const bySeason = d3.group(stops, (x) => x.y);
      const seasons = [...bySeason.keys()].sort((a, b) => a - b);
      const partial = F1.partialYearsIn(s)[0];
      wrap.append(h('div', { class: 'row r2' },
        F1.chartCard({ title: 'Typical pit-lane time by season', src: 'fact_pits', def: 'Median (and 10th–90th percentile range) of pit-lane times ≤ 60 s for each season.', note: 'Hover for counts. Early seasons are sparse.', actions: null }, (host, setTitle) => {
          const rows = seasons.map((y) => { const v = bySeason.get(y).filter((x) => x.ms != null && x.ms <= TYPICAL_MS).map((x) => x.ms).sort((a, b) => a - b); return v.length >= 5 ? { y, med: d3.median(v), lo: d3.quantileSorted(v, 0.1), hi: d3.quantileSorted(v, 0.9), n: v.length } : null; }).filter(Boolean);
          const md = rows.map((r) => [r.y, r.med / 1000]), sf = (v) => v.toFixed(1) + ' s';
          if (rows.length >= 2) setTitle(ui.changeTitle('The typical pit-lane time', { x: rows[0].y, v: rows[0].med / 1000 }, { x: rows[rows.length - 1].y, v: rows[rows.length - 1].med / 1000 }, sf));
          charts.line(host, { series: [{ name: 'Median', data: md, color: ui.C.hi, fmt: (v) => v.toFixed(2) + ' s' }, { name: '90th percentile', data: rows.map((r) => [r.y, r.hi / 1000]), color: ui.C.soft, fmt: (v) => v.toFixed(2) + ' s' }, { name: '10th percentile', data: rows.map((r) => [r.y, r.lo / 1000]), color: ui.C.base, fmt: (v) => v.toFixed(2) + ' s' }], height: 270, endLabels: true, yTitle: 'Pit-lane time (seconds)', xTitle: 'Season', annotate: ui.autoNotes(md, sf, { peak: false, trough: true, last: false, lastLabel: null }), y: { fmt: (v) => v + ' s', zero: false }, partial: partial ? { from: partial.year } : null, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Pit stop duration by season' });
        }),
        F1.chartCard({ title: 'Stops per car by season', src: 'fact_pits', def: 'Average number of recorded stops per car that made a stop, by season.', note: 'Strategy and regulation changes show up here — the chart is descriptive only.' }, (host, setTitle) => {
          const rows = seasons.map((y) => { const v = bySeason.get(y), cars = new Set(v.map((x) => x.r + '|' + x.d)).size; return { y, v: v.length / cars, n: cars }; });
          const sp = rows.map((r) => [r.y, r.v]);
          if (rows.length >= 2) setTitle(ui.changeTitle('Stops per car', { x: rows[0].y, v: rows[0].v }, { x: rows[rows.length - 1].y, v: rows[rows.length - 1].v }, fmt.d1));
          charts.line(host, { series: [{ name: 'Stops per car', data: sp, color: ui.C.hi, fmt: fmt.d2 }], height: 270, yTitle: 'Stops per car that stopped', xTitle: 'Season', annotate: ui.autoNotes(sp, fmt.d1, { peak: true, trough: true, last: false }), y: { fmt: d3.format('.1f'), zero: false }, partial: partial ? { from: partial.year } : null, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Stops per car by season' });
        })));
      wrap.append(h('div', { class: 'row r2' },
        F1.chartCard({ title: 'Distribution of pit-lane times', src: 'fact_pits', def: 'Histogram of pit-lane times ≤ 60 s in 1-second bins (clipped to the 1st–99th percentile).', note: `${fmt.int(typ.length)} typical stops.` }, (host, setTitle) => {
          if (typ.length < 20) { host.replaceChildren(ui.empty('Too few timed stops')); return; }
          const v = typ.map((x) => x.ms / 1000).sort((a, b) => a - b), lo = Math.floor(d3.quantileSorted(v, 0.01)), hi = Math.ceil(d3.quantileSorted(v, 0.99));
          const bins = d3.bin().domain([lo, hi]).thresholds(d3.range(lo, hi + 1))(v.filter((t) => t >= lo && t <= hi));
          const mode = bins.reduce((a, b) => (b.length > a.length ? b : a));
          setTitle(`Most stops spend ${mode.x0}–${mode.x1} seconds in the pit lane`);
          charts.columns(host, { data: bins.map((b) => ({ k: b.x0, label: b.x0 + '–' + b.x1 + ' s', v: b.length })), height: 250, yTitle: 'Number of stops', xTitle: 'Pit-lane time (1-second bins)', highlight: (d) => d.k === mode.x0, y: { fmt: d3.format(',') }, name: 'Stops', tickEvery: Math.max(1, Math.ceil(bins.length / 10)), aria: 'Pit stop time histogram' });
        }),
        F1.chartCard({ title: 'When in the race stops happen', src: 'fact_pits', def: 'Count of stops by lap number in 5-lap bins.', note: 'Lap of the stop as recorded; not normalised by race length.' }, (host, setTitle) => {
          const laps = stops.filter((x) => x.lap != null), bins = d3.bin().thresholds(d3.range(0, 80, 5)).domain([0, 80])(laps.map((x) => x.lap));
          const mode = bins.reduce((a, b) => (b.length > a.length ? b : a), bins[0]);
          if (mode && mode.length) setTitle(`Stops cluster in laps ${mode.x0}–${mode.x1}`);
          charts.columns(host, { data: bins.map((b) => ({ k: b.x0, label: `${b.x0}–${b.x1}`, v: b.length })), height: 250, yTitle: 'Number of stops', xTitle: 'Race lap (5-lap bins)', highlight: (d) => mode && d.k === mode.x0, y: { fmt: d3.format(',') }, name: 'Stops', tickEvery: 2, aria: 'Pit stop lap histogram' });
        })));
      const byCons = d3.group(typ.filter((x) => cmap.has(x.r + '|' + x.d)), (x) => cmap.get(x.r + '|' + x.d));
      const consRows = [...byCons].map(([c, v]) => { const t = v.map((x) => x.ms).sort((a, b) => a - b); return { c, name: F1.name.cons(c), n: t.length, med: d3.median(t), best: t[0], p90: d3.quantileSorted(t, 0.9) }; }).filter((r) => r.n >= 20);
      wrap.append(h('div', { class: 'row r2' },
        ui.card({ title: 'Pit-lane time by constructor', note: 'Teams with ≥20 typical stops in the selection. Click to filter. Differences mix car, crew, era and circuit.', src: 'fact_pits fact_results' }, ui.table({
          id: 'tbl-pit-cons', cols: [{ key: 'name', label: 'Constructor' }, { key: 'n', label: 'Stops', num: true, fmt: fmt.int }, { key: 'med', label: 'Median', num: true, fmt: fmt.sec }, { key: 'best', label: 'Best', num: true, fmt: fmt.sec }, { key: 'p90', label: '90th pct', num: true, fmt: fmt.sec }],
          rows: consRows, sort: { key: 'med', dir: 'asc' }, search: (r) => r.name, placeholder: 'Search constructors…', maxH: '360px', onRow: (r) => F1.pick({ cons: r.c }), isSel: (r) => r.c === s.cons, empty: 'No constructor has ≥20 typical stops here.',
        })),
        ui.card({ title: 'Fastest recorded pit-lane times', note: 'Top 25 shortest typical stops in the selection. A large negative gap to the race median flags a value worth double-checking.', src: 'fact_pits' }, ui.table({
          id: 'tbl-pit-fast', cols: [{ key: 'ms', label: 'Pit-lane time', num: true, fmt: fmt.sec }, { key: 'gap', label: 'Vs race median', num: true, val: (r) => (raceMed.get(r.r) ? (r.ms - raceMed.get(r.r)) / 1000 : null), fmt: (v) => (v == null ? '—' : fmt.signed(v) + ' s'), def: 'Difference to the median pit-lane time of the same race (all teams). Large negative values are outliers.' }, { key: 'd', label: 'Driver', val: (r) => F1.name.driver(r.d) }, { key: 'c', label: 'Constructor', val: (r) => (cmap.get(r.r + '|' + r.d) ? F1.name.cons(cmap.get(r.r + '|' + r.d)) : null) }, { key: 'race', label: 'Race', val: (r) => M.raceById.get(r.r).year + ' ' + M.raceById.get(r.r).name }, { key: 'lap', label: 'Lap', num: true, fmt: (v) => (v == null ? '—' : v) }],
          rows: typ.slice().sort((a, b) => a.ms - b.ms).slice(0, 25), sort: { key: 'ms', dir: 'asc' }, maxH: '360px', search: (r) => `${F1.name.driver(r.d)} ${M.raceById.get(r.r).name} ${M.raceById.get(r.r).year}`, placeholder: 'Search…',
        }))));
      return wrap;
    },
  };
})();
