/* F1 Evolution - pages: F1 Through the Eras, Data Quality & Coverage */
(function () {
  'use strict';
  const F1 = window.F1, ui = F1.ui, h = ui.h, fmt = F1.fmt, charts = F1.charts, DEF = F1.DEF;
  const sgColor = ['#2FC79A', '#56B4E9', '#E69F00', '#CC79A7', '#B6BDC9', '#8FA1FF', '#4a5362'];

  /* ================================================================== THROUGH THE ERAS */
  function eraData(st) {
    const M = F1.M, rows = F1.rows(Object.assign({}, st, { driver: null, cons: null, circuit: null })), spr = F1.sprintRows(Object.assign({}, st, { driver: null, cons: null, circuit: null }));
    const bySeason = F1.groupAgg(rows, (x) => x.y, spr), out = [];
    const winners = d3.rollup(rows.filter((x) => x.p === 1), (v) => new Set(v.map((x) => x.d)).size, (x) => x.y);
    for (let y = st.y0; y <= st.y1; y++) {
      const S = M.seasons.get(y), a = bySeason.get(y), tot = M.seasonTot.get(y); if (!S || !a || !a.starts) continue;
      const cd = M.champD.get(y);
      const wp = S.races.filter((r) => r.done && r.wpts != null).map((r) => r.wpts);
      const modeWin = (() => { const c = d3.rollup(wp, (v) => v.length, (v) => v); let b = null, n = 0; c.forEach((k, v) => { if (k > n || (k === n && v > b)) { n = k; b = v; } }); return b; })();
      const cs = [...tot.ptsByCons.values()].sort((p, q) => q - p);
      out.push({ y, S, a, winners: winners.get(y) || 0, drivers: tot.drivers.size, cons: tot.cons.size, perRace: tot.starts / S.held, medWin: modeWin, cd,
        margin: cd && S.complete && cd.margin != null && S.maxAvail ? cd.margin / S.maxAvail : null,
        top2: cs.length >= 2 && tot.pts ? (cs[0] + cs[1]) / d3.sum(cs) : null, partial: !S.complete });
    }
    return out;
  }
  function decadeTable(st) {
    const M = F1.M, rows = F1.rows(Object.assign({}, st, { driver: null, cons: null, circuit: null })), out = [];
    const byDec = d3.group(rows, (x) => Math.floor(x.y / 10) * 10);
    byDec.forEach((rs, dec) => {
      const wins = rs.filter((x) => x.p === 1), races = new Set(rs.filter((x) => x.s !== 6).map((x) => x.r)).size;
      const dw = d3.rollups(wins, (v) => v.length, (x) => x.d).sort((a, b) => b[1] - a[1]), cw = d3.rollups(wins, (v) => v.length, (x) => x.c).sort((a, b) => b[1] - a[1]);
      const tw = wins.length, a = F1.aggregate(rs);
      const years = [...new Set(rs.map((x) => x.y))].sort(), partial = years.some((y) => !M.seasons.get(y).complete);
      out.push({ dec, label: dec + 's', y0: years[0], y1: years[years.length - 1], races, starts: a.starts, dwin: dw.length, topD: dw[0] ? F1.name.driver(dw[0][0]) : null, topDn: dw[0] ? dw[0][1] : 0, topDs: tw ? dw[0][1] / tw : null, top3Ds: tw ? d3.sum(dw.slice(0, 3), (x) => x[1]) / tw : null, topC: cw[0] ? F1.name.cons(cw[0][0]) : null, topCn: cw[0] ? cw[0][1] : 0, topCs: tw ? cw[0][1] / tw : null, dnf: a.dnfRate, mech: a.mechRate, acc: a.accRate, fin: a.finRate, partial, tw });
    });
    return out.sort((a, b) => a.dec - b.dec);
  }

  F1.pages.eras = {
    needs: [],
    render() {
      const M = F1.M, s = F1.state, wrap = h('div'), ps = (F1.ps.eras = Object.assign({ bal: 'div', dec: 'driver' }, F1.ps.eras));
      const head = F1.pageHead('F1 Through the Eras', 'F1 through the eras, ' + F1.rangeLabel(s), 'Season-by-season and decade-by-decade comparisons across scoring systems, calendars and car counts. Everything here is derived from the dataset except the clearly labelled external-context panel.');
      wrap.append(head);
      if (s.driver || s.cons || s.circuit) wrap.append(ui.banner('info', h('b', null, 'Entity filters are ignored on this page. '), 'Era comparisons need the whole field, so only the season range applies (driver, constructor and circuit filters stay set for other pages).'));
      const st = { y0: s.y0, y1: s.y1 }, data = eraData(st);
      if (data.length < 2) { wrap.append(ui.empty('Pick at least two seasons', 'Era comparisons need a range of seasons.')); return wrap; }
      const e0 = data[0], e1 = data.filter((d) => !d.partial).slice(-1)[0] || data[data.length - 1];
      F1.setHeadline(head, `From ${e0.y} to ${e1.y} the calendar grew from ${e0.S.held} to ${e1.S.held} races and the retirement rate fell from ${fmt.p0(e0.a.dnfRate)} to ${fmt.p0(e1.a.dnfRate)} of starts; distinct winners per race went from ${fmt.p0(e0.winners / e0.S.held)} to ${fmt.p0(e1.winners / e1.S.held)}.`);
      const partial = F1.partialYearsIn(st)[0], pp = partial ? { from: partial.year } : null;
      const comp = data.filter((d) => !d.partial), lastC = comp[comp.length - 1] || data[data.length - 1];
      const pooled = (xs, f) => d3.sum(xs, (d) => f(d.a)) / d3.sum(xs, (d) => d.a.starts), span = (xs) => (xs[0].y === xs[xs.length - 1].y ? '' + xs[0].y : `${xs[0].y}–${xs[xs.length - 1].y}`);
      const peakDrop = (key) => { const notes = []; if (comp.length >= 4) { const pk = comp.reduce((a, b) => (b[key] > a[key] ? b : a)), dr = comp.map((d, i) => (i ? { d, r: comp[i - 1][key] ? (d[key] - comp[i - 1][key]) / comp[i - 1][key] : 0, abs: d[key] - comp[i - 1][key] } : null)).filter(Boolean).reduce((a, b) => (b.abs < a.abs ? b : a)); if (pk !== lastC) notes.push({ k: pk.y, text: `Peak ${pk[key]} (${pk.y})` }); if (dr.r <= -0.1 && dr.d !== pk) notes.push({ k: dr.d.y, text: `${dr.d.y}: ${dr.d[key]} (${Math.round(100 * dr.r)}%)` }); } return notes; };
      const line = (name, key, color, f) => ({ name, data: data.map((d) => [d.y, d[key]]), color, fmt: f });
      /* calendar */
      wrap.append(h('div', { class: 'row r2' },
        F1.chartCard({ title: 'Calendar growth', src: 'fact_races', def: 'Races with results per season (solid) and scheduled races still without results (muted). Calendar entries are from the races table.', note: 'Grands Prix per season.' }, (host, setTitle) => {
          const cal = data.map((d) => Object.assign(d, { held: d.S.held }));
          setTitle(ui.changeTitle('Races per season', { x: cal[0].y, v: cal[0].held }, { x: lastC.y, v: lastC.held }, d3.format(',')));
          charts.columns(host, { data: cal.map((d) => ({ k: d.y, label: '' + d.y, stack: { held: d.S.held, rest: d.S.sched - d.S.held }, partial: false })), stacks: [{ key: 'held', name: 'Held', color: ui.C.hi }, { key: 'rest', name: 'Not yet held', color: ui.C.base }], height: 250, yTitle: 'Races per season', xTitle: 'Season', annotate: peakDrop('held'), onClick: (d) => F1.pick({ y0: d.k, y1: d.k }), aria: 'Calendar growth' });
        }),
        F1.chartCard({ title: 'Participation', src: 'fact_results', def: 'Distinct drivers and constructors with a start each season, and average starters per race (car starts ÷ races held).', note: 'Entry lists and field sizes across time.' }, (host, setTitle) => {
          setTitle(ui.changeTitle('Drivers per season', { x: data[0].y, v: data[0].drivers }, { x: lastC.y, v: lastC.drivers }, fmt.int));
          const pkD = data.reduce((a, b) => (b.drivers > a.drivers ? b : a));
          charts.line(host, { series: [line('Drivers', 'drivers', ui.C.hi, fmt.int), line('Constructors', 'cons', ui.C.cmp, fmt.int), line('Starters per race', 'perRace', ui.C.soft, fmt.d1)], height: 270, endLabels: true, yTitle: 'Count per season', xTitle: 'Season', annotate: pkD !== data[data.length - 1] ? [{ x: pkD.y, y: pkD.drivers, text: `Peak ${pkD.drivers} drivers (${pkD.y})` }] : [], y: { fmt: d3.format(',') }, partial: pp, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Participation over time' });
        })));
      /* scoring fingerprint */
      const runs = []; data.forEach((d) => { const l = runs[runs.length - 1]; if (l && l.v === d.medWin) l.to = d.y; else runs.push({ from: d.y, to: d.y, v: d.medWin }); });
      wrap.append(h('div', { class: 'row r-ms' },
        F1.chartCard({ title: 'Scoring systems in the data', src: 'fact_races', def: 'Most common recorded points of the race winner per season (the mode — shared drives, fastest-lap bonuses and one-off double-points rounds are outliers), derived from the results table. A change in this line marks a points-system change; it is NOT re-scored — each season keeps its own system. Era-normalised metrics divide by the points actually available.', note: 'What a Grand Prix win was worth, season by season (dataset-derived).' }, (host, setTitle) => {
          const lr = runs[runs.length - 1], jumps = runs.map((r, i) => (i && Math.abs(r.v - runs[i - 1].v) >= 5 ? { x: r.from, y: r.v, text: `${fmt.pts(runs[i - 1].v)} → ${fmt.pts(r.v)} points (${r.from})`, below: true } : null)).filter(Boolean);
          setTitle(`A win has been worth ${fmt.pts(lr.v)} points ${lr.from === lr.to ? 'in ' + lr.from : 'since ' + lr.from}`);
          charts.line(host, { series: [line('Winner’s points', 'medWin', ui.C.hi, fmt.pts)], height: 250, yTitle: 'Points awarded to the winner', xTitle: 'Season', annotate: jumps, y: { fmt: d3.format(','), zero: true }, partial: pp, aria: 'Points awarded to the winner over time' });
        }),
        ui.card({ title: 'Detected changes', note: 'Runs of seasons where a win was worth the same (most common winner’s points).', src: 'fact_races' }, ui.table({ cols: [{ key: 'from', label: 'Seasons', fmt: (v, r) => (r.from === r.to ? r.from : `${r.from}–${r.to}`) }, { key: 'v', label: 'Win worth', num: true, fmt: fmt.pts }], rows: runs, sort: { key: 'from', dir: 'asc' }, maxH: '260px' }))));
      /* dominance by decade */
      const dec = decadeTable(st);
      wrap.append(h('div', { class: 'sec-h' }, 'Dominance by decade'));
      wrap.append(h('div', { class: 'row r-ms' },
        F1.chartCard({ title: ps.dec === 'driver' ? 'Share of wins taken by the top driver' : 'Share of wins taken by the top constructor', src: 'fact_results', def: 'Wins by the decade’s most successful driver (or constructor) ÷ all win credits in that decade. Higher = more concentrated success. Partial decades are hatched.', note: 'Hover for who it was.',
          actions: ui.seg({ label: 'Dominance entity', value: ps.dec, options: [{ id: 'driver', label: 'Driver' }, { id: 'cons', label: 'Constructor' }], onChange: (v) => { ps.dec = v; F1.go(); } }) }, (host, setTitle) => {
          const val = (d) => (ps.dec === 'driver' ? d.topDs : d.topCs), who = (d) => (ps.dec === 'driver' ? d.topD : d.topC), mx = dec.reduce((a, b) => (val(b) > val(a) ? b : a));
          setTitle(`${who(mx)} took ${fmt.p0(val(mx))} of the ${mx.label}’ wins — the most concentrated decade`);
          charts.columns(host, { data: dec.map((d) => ({ k: d.dec, label: d.label, v: val(d), partial: d.partial, tip: [['Leader', ps.dec === 'driver' ? d.topD : d.topC], ['Wins', ps.dec === 'driver' ? d.topDn : d.topCn], ['Win credits in decade', d.tw]] })), height: 260, yTitle: ps.dec === 'driver' ? 'Top driver’s share of wins' : 'Top constructor’s share of wins', xTitle: 'Decade', highlight: (d) => d.k === mx.dec, annotate: [{ k: mx.dec, text: fmt.p0(val(mx)) }], y: { fmt: fmt.p0 }, valFmt: fmt.p1, name: 'Share of wins', tickEvery: 1, aria: 'Dominance by decade' });
        }),
        ui.card({ title: 'Decade summary', note: 'Distinct winners and leaders per decade.', src: 'fact_results' }, ui.table({
          id: 'tbl-decades', cols: [{ key: 'label', label: 'Decade', val: (r) => r.dec, fmt: (v, r) => r.label + (r.partial ? '*' : '') }, { key: 'races', label: 'GPs', num: true, fmt: fmt.int }, { key: 'dwin', label: 'Winners', num: true, fmt: fmt.int, def: 'Distinct race-winning drivers in the decade.' }, { key: 'topD', label: 'Top driver', cls: 'mut' }, { key: 'top3Ds', label: 'Top-3 share', num: true, fmt: fmt.p0, def: 'Share of win credits taken by the decade’s three most successful drivers.' }, { key: 'topC', label: 'Top constructor', cls: 'mut' }],
          rows: dec, sort: { key: 'label', dir: 'asc' }, maxH: '280px',
        }))));
      /* normalised rates */
      wrap.append(h('div', { class: 'sec-h' }, 'Reliability and finishing, normalised per start'));
      wrap.append(h('div', { class: 'row r2' },
        F1.chartCard({ title: 'Retirement causes per start', src: 'fact_results dim_status', def: DEF.dnfRate + ' Stacked: mechanical, accident, other retirements as a share of starts.', note: 'Normalising by starts removes the effect of bigger fields.' }, (host, setTitle) => {
          const A = comp.slice(0, 3), B = comp.slice(-3), pkR = comp.length ? comp.reduce((a, b) => (b.a.dnfRate > a.a.dnfRate ? b : a)) : null;
          if (comp.length >= 6) setTitle(ui.changeTitle('Mechanical failures', { x: span(A), v: pooled(A, (a) => a.sg[2]) }, { x: span(B), v: pooled(B, (a) => a.sg[2]) }, fmt.p0) + ' of starts');
          charts.columns(host, { data: data.map((d) => ({ k: d.y, label: '' + d.y, partial: d.partial, stack: { mech: d.a.mechRate, acc: d.a.accRate, oth: d.a.sg[5] / d.a.starts }, tip: [['Total DNF rate', fmt.p1(d.a.dnfRate)]] })), stacks: [{ key: 'mech', name: 'Mechanical', color: ui.C.cmp }, { key: 'acc', name: 'Accident', color: ui.C.soft }, { key: 'oth', name: 'Other', color: ui.C.base }], height: 270, yTitle: 'Share of starts retired', xTitle: 'Season', annotate: pkR ? [{ k: pkR.y, text: `Peak ${fmt.p0(pkR.a.dnfRate)} (${pkR.y})` }] : [], y: { fmt: fmt.p0 }, onClick: (d) => F1.pick({ y0: d.k, y1: d.k }), aria: 'Retirement causes' });
        }),
        F1.chartCard({ title: 'Classified-finish rate', src: 'fact_results', def: 'Classified finishes ÷ starts. Classification rules changed over time, so compare trends rather than single years.', note: 'Share of starters officially classified.' }, (host, setTitle) => {
          const fr = data.map((d) => [d.y, d.a.finRate]);
          setTitle(ui.changeTitle('The classified-finish rate', { x: data[0].y, v: data[0].a.finRate }, { x: lastC.y, v: lastC.a.finRate }, fmt.p0));
          charts.line(host, { series: [{ name: 'Classified finish rate', data: fr, color: ui.C.hi, fmt: fmt.p1 }], height: 270, yTitle: 'Share of starters classified', xTitle: 'Season', annotate: ui.autoNotes(comp.map((d) => [d.y, d.a.finRate]), fmt.p0, { peak: false, trough: true, last: true }), y: { fmt: fmt.p0, domain: [0, 1] }, partial: pp, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Classified finish rate' });
        })));
      /* competitive balance */
      const bal = { div: ['Winner diversity', 'winRatio', 'Distinct race winners ÷ races held in the season (1 = a different winner every race).', fmt.p0], margin: ['Title margin', 'margin', 'Champion’s final-standing lead over P2, as a % of the season’s maximum available points (completed seasons only).', fmt.p1], top2: ['Top-2 constructors’ share', 'top2', 'Points of the two highest-scoring constructors ÷ all constructor points that season.', fmt.p0], di: ['Champion dominance', 'diC', DEF.di, fmt.p1] };
      data.forEach((d) => { d.winRatio = d.S.held ? d.winners / d.S.held : null; });
      const domAll = F1.dominance(F1.rows(Object.assign({}, st)), F1.sprintRows(Object.assign({}, st))), diMap = new Map(domAll.map((x) => [x.id + '|' + x.year, x.di]));
      data.forEach((d) => { d.diC = d.cd && d.S.complete ? diMap.get(d.cd.d + '|' + d.y) ?? null : null; });
      const b = bal[ps.bal];
      wrap.append(h('div', { class: 'sec-h' }, 'Competitive balance'));
      wrap.append(h('div', { class: 'row' }, F1.chartCard({ title: b[0], src: 'fact_results std_drivers std_constructors', def: b[2], note: 'Dataset-derived. Titles and margins use completed seasons only.',
        actions: ui.seg({ label: 'Balance metric', value: ps.bal, options: Object.keys(bal).map((k) => ({ id: k, label: bal[k][0] })), onChange: (v) => { ps.bal = v; F1.go(); } }) }, (host, setTitle) => {
        const ok = comp.filter((d) => d[b[1]] != null), bd = data.map((d) => [d.y, d[b[1]]]);
        if (ok.length >= 2) setTitle(ui.changeTitle(b[0], { x: ok[0].y, v: ok[0][b[1]] }, { x: ok[ok.length - 1].y, v: ok[ok.length - 1][b[1]] }, b[3]));
        charts.line(host, { series: [{ name: b[0], data: bd, color: ui.C.hi, fmt: b[3] }], height: 270, yTitle: b[0], xTitle: 'Season', annotate: ui.autoNotes(comp.map((d) => [d.y, d[b[1]]]), b[3], { peak: true, trough: true, last: false }), y: { fmt: ps.bal === 'margin' || ps.bal === 'di' ? fmt.p0 : fmt.p0, zero: true }, partial: pp, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Competitive balance' });
      })));
      /* external context */
      wrap.append(h('div', { class: 'sec-h' }, 'Context'));
      const lapStart = d3.min(M.races.filter((r) => r.nlap > 0), (r) => r.year), pitStart = d3.min(M.races.filter((r) => r.npit > 0), (r) => r.year), qStart = d3.min(M.races.filter((r) => r.nq > 0), (r) => r.year), sprStart = d3.min(M.races.filter((r) => r.sprint), (r) => r.year), consStart = d3.min([...M.champC.keys()]);
      wrap.append(h('div', { class: 'row r2' },
        ui.card({ title: 'Seen in the dataset', note: 'Facts measured from the tables.', src: 'fact_races std_constructors' }, h('dl', { class: 'def-list' },
          h('dt', null, 'Seasons'), h('dd', null, `${M.minYear}–${M.maxYear} (${M.years.length} seasons; ${M.years.filter((y) => M.seasons.get(y).complete).length} complete)`),
          h('dt', null, 'Constructors’ standings'), h('dd', null, `from ${consStart}`), h('dt', null, 'Qualifying rows'), h('dd', null, `from ${qStart}`), h('dt', null, 'Lap times'), h('dd', null, `from ${lapStart}`),
          h('dt', null, 'Pit stops'), h('dd', null, `from ${pitStart}`), h('dt', null, 'Sprints'), h('dd', null, `from ${sprStart}`), h('dt', null, 'Fewest / most races'), h('dd', null, `${d3.min(M.years.map((y) => M.seasons.get(y).held).filter((v) => v), (v) => v)} / ${d3.max(M.years, (y) => M.seasons.get(y).sched)} per season`))),
        ui.card({ title: 'External historical context', note: 'Not derived from the dataset — general background to help read the charts.', cls: 'ext' },
          h('ul', { class: 'insights' },
            h('li', null, 'The first World Championship season is 1950; the Constructors’ Championship is introduced in 1958.', h('small', null, 'Both match the first rows present in the standings tables above.')),
            h('li', null, 'The 2020 calendar was shortened because of the COVID-19 pandemic.', h('small', null, 'Visible as a drop in races per season.')),
            h('li', null, 'Sprint events were introduced in 2021, and 2014 brought hybrid power units and a double-points final round.', h('small', null, 'The 2014 effect appears in the scoring-systems chart; era presets marked † use this external boundary.')),
            h('li', null, 'Team names change with ownership: this dashboard does not merge constructor IDs.', h('small', null, 'See Data Quality → constructor identity.'))))));
      return wrap;
    },
  };

  /* ================================================================== DATA QUALITY */
  const NULL_MEANING = {
    'results.position': 'Not classified: retired, disqualified or did not start. Stays blank — never treated as position 0.', 'results.grid': 'Grid slot not recorded (distinct from grid = 0, which is stored as a value).',
    'results.fastestLap': 'Fastest-lap fields are only recorded for part of history.', 'results.rank': 'Fastest-lap rank only recorded for part of history.', 'results.fastestLapTime': 'Only recorded for part of history.', 'results.fastestLapSpeed': 'Only recorded for part of history.',
    'results.time': 'Race time only stored for finishers on the lead lap or with a gap.', 'results.milliseconds': 'Same as results.time.', 'results.number': 'Car number not stored.',
    'qualifying.q1': 'Did not set a Q1 time.', 'qualifying.q2': 'Eliminated in Q1, or the format had no Q2.', 'qualifying.q3': 'Eliminated earlier, or the format had no Q3.',
    'pit_stops.duration': 'Duration not recorded for this stop.', 'pit_stops.milliseconds': 'Duration not recorded for this stop.', 'drivers.number': 'No permanent number assigned.', 'drivers.code': 'No three-letter code.',
    'sprint_results.position': 'Not classified in the sprint.', 'sprint_results.statusId': 'Status missing; shown as Other DNF.', 'sprint_results.rank': 'Rank not recorded.', 'driver_standings.position': 'Standing position not stored.',
    'constructor_standings.position': 'Standing position not stored.', 'constructor_results.status': 'Mostly unused flag column.', 'races.time': 'Start time not stored for older races.',
  };
  const typed = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };

  function checks() {
    const M = F1.M, out = [], add = (name, status, detail) => out.push({ name, status, detail });
    const fk = typed('dq_fk') || [], tb = typed('dq_tables') || [], txt = typed('dq_text') || [];
    const unm = d3.sum(fk, (r) => +r.unmatched);
    add('Foreign keys resolve', unm === 0 ? 'pass' : 'fail', `${fk.length} relationships checked (race, driver, constructor, circuit, status); ${unm} unmatched keys.`);
    const dupT = tb.filter((r) => +r.dupKeys > 0);
    add('Primary keys unique', dupT.length ? 'warn' : 'pass', dupT.length ? dupT.map((r) => `${r.table}: ${fmt.int(+r.dupKeys)} repeated key${+r.dupKeys === 1 ? '' : 's'}`).join('; ') + '. Repeated lap rows are de-duplicated (first kept) before lap aggregation.' : 'No repeated primary keys in any table.');
    const keyCount = d3.rollup(M.results, (v) => v.length, (x) => x.r + '|' + x.d); const multi = [...keyCount.values()].filter((v) => v > 1).length;
    add('Shared drives / multi-car entries', 'info', `${multi} race-driver pairs appear more than once in results (a driver in two cars in one race). Each race counts once as a race for the driver; every row still counts as a car entry.`);
    const noWin = [...M.resByRace].filter(([, rs]) => !rs.some((x) => x.p === 1)).length, twoWin = [...M.resByRace].filter(([, rs]) => rs.filter((x) => x.p === 1).length > 1).length;
    add('Every race has a winner', noWin === 0 ? 'pass' : 'fail', `${M.resByRace.size} races with results; ${noWin} without a classified winner. ${twoWin} races credit two winners (shared drive), so driver win credits exceed races by ${twoWin}.`);
    const winRows = M.results.filter((x) => x.p === 1).length, lbWins = d3.sum(F1.leaderboard('driver', { y0: M.minYear, y1: M.maxYear, driver: null, cons: null, circuit: null }, null), (a) => a.wins), lbC = d3.sum(F1.leaderboard('cons', { y0: M.minYear, y1: M.maxYear, driver: null, cons: null, circuit: null }, null), (a) => a.wins);
    add('KPI totals reconcile', winRows === lbWins && winRows === lbC ? 'pass' : 'fail', `Winning rows ${fmt.int(winRows)} = Σ driver wins ${fmt.int(lbWins)} = Σ constructor wins ${fmt.int(lbC)}.`);
    const done = M.years.filter((y) => M.seasons.get(y).complete), noChamp = done.filter((y) => !M.champD.has(y) || M.champD.get(y).recalc), noConsChamp = done.filter((y) => y >= 1958 && (!M.champC.has(y) || M.champC.get(y).recalc));
    add('Titles come from final standings', noChamp.length + noConsChamp.length === 0 ? 'pass' : 'warn', `${done.length} completed seasons; ${noChamp.length} without an official P1 driver row${noChamp.length ? ' (' + noChamp.join(', ') + ')' : ''}; ${noConsChamp.length} without an official P1 constructor row (1958+).`);
    const inc = M.years.filter((y) => !M.seasons.get(y).complete);
    add('Incomplete seasons flagged', inc.length ? 'warn' : 'pass', inc.length ? inc.map((y) => `${y}: ${M.seasons.get(y).held}/${M.seasons.get(y).sched} races with results`).join('; ') + `. Latest result in the data: ${M.lastDate}.` : 'All seasons complete.');
    const nanPts = M.results.filter((x) => !isFinite(x.pt)).length;
    add('Points never missing', nanPts === 0 ? 'pass' : 'fail', `${nanPts} result rows without numeric points. A stored 0 is a real zero; ${fmt.int(M.results.filter((x) => x.pt === 0 && x.s !== 6).length)} starts scored 0.`);
    const unmapped = M.results.filter((x) => x.si == null || !M.status.has(String(x.si))).length;
    add('Status mapped to groups', unmapped === 0 ? 'pass' : 'fail', `${fmt.int(M.results.length)} results mapped to ${F1.SG.length} status groups; ${unmapped} unmapped.`);
    const mism = M.results.filter((x) => x.p != null && x.p !== x.o).length;
    add('Classified vs finishing order', mism ? 'info' : 'pass', `${mism} classified rows have a position that differs from positionOrder (post-race reclassification). Classification uses positionText (digits only); ordering uses positionOrder.`);
    const g0 = M.results.filter((x) => x.g === 0).length, gn = M.results.filter((x) => x.g == null).length;
    add('Grid slot 0 / missing', 'info', `${fmt.int(g0)} rows have grid = 0 and ${gn} have no grid value; both are excluded from grid-based rates.`);
    const cls = txt.filter((r) => /positionText/.test(r.check)), clsN = d3.sum(cls, (r) => +r.value);
    add('Classification flag consistent', clsN ? 'warn' : 'pass', clsN ? `${clsN} result and sprint rows carry a position although positionText says retired / disqualified / withdrawn (${cls[0].check.replace(/.*, years /, 'years ')}). The source fills position for these only in the latest seasons, so classification uses positionText (digits only) everywhere — otherwise 2025–26 would show 100% classified finishers.` : 'positionText and position agree for every row.');
    const bad = txt.filter((r) => +r.value > 0 && /U\+FFFD/.test(r.check));
    add('Text encoding', bad.length ? 'warn' : 'pass', bad.length ? bad.map((r) => `${r.check}: ${r.value}`).join('; ') : 'No replacement characters found in driver, constructor, circuit or race names.');
    return out;
  }

  function officialVsRecorded() {
    const M = F1.M, rows = [];
    M.years.forEach((y) => {
      const S = M.seasons.get(y); if (!S.complete) return;
      const off = d3.sum(M.finalD.get(y) || [], (r) => r.pt), tot = M.seasonTot.get(y);
      if (!(M.finalD.get(y) || []).length) return;
      rows.push({ y, off, rec: tot.pts, diff: tot.pts - off });
    });
    return rows;
  }

  F1.pages.quality = {
    needs: ['dq_tables', 'dq_nulls', 'dq_fk', 'dq_coverage', 'dq_text'],
    render() {
      const M = F1.M, wrap = h('div');
      const head = F1.pageHead('Data Quality & Coverage', 'What the data covers — and where it does not', 'Validation results are computed from the raw tables (prep step) and from the loaded model. Nothing here is hard-coded: each status is a real test against the data.');
      wrap.append(head);
      const tb = typed('dq_tables'), nl = typed('dq_nulls'), cv = typed('dq_coverage');
      if (!tb || !nl || !cv) { wrap.append(F1.hostLoading(6)); return wrap; }
      const ck = checks(), pill = { pass: 'ok', warn: 'warn', fail: 'bad', info: '' };
      F1.setHeadline(head, `${ck.filter((c) => c.status === 'pass').length} of ${ck.filter((c) => c.status !== 'info').length} scored checks pass; the data runs to ${M.lastDate}, and ${M.years.filter((y) => !M.seasons.get(y).complete).join(', ') || 'no season'} ${M.years.filter((y) => !M.seasons.get(y).complete).length === 1 ? 'is' : 'are'} incomplete.`);
      wrap.append(h('div', { class: 'kpis', 'data-source': 'dq_tables dq_fk dq_coverage' },
        ui.kpi({ label: 'Tables loaded', value: fmt.int(tb.length), sub: `${fmt.int(d3.sum(tb, (r) => +r.rows))} raw rows` }),
        ui.kpi({ label: 'Checks passed', value: `${ck.filter((c) => c.status === 'pass').length}/${ck.filter((c) => c.status !== 'info').length}`, accent: 'red', def: 'Pass / (pass + warn + fail). “Info” rows describe features of the data and are not scored.', sub: `${ck.filter((c) => c.status === 'warn' || c.status === 'fail').length} need attention · ${ck.filter((c) => c.status === 'info').length} informational` }),
        ui.kpi({ label: 'Latest result', value: h('span', { style: { fontSize: '24px' } }, M.lastDate), sub: 'data cut-off' }),
        ui.kpi({ label: 'Incomplete seasons', value: fmt.int(M.years.filter((y) => !M.seasons.get(y).complete).length), sub: M.years.filter((y) => !M.seasons.get(y).complete).join(', ') || 'none', accent: 'gold' })));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Validation checks', note: 'Real tests; “info” rows describe features of the data that shape the metrics.', src: 'dq_fk dq_tables dq_text fact_results std_drivers' },
        ui.table({ id: 'tbl-checks', cols: [{ key: 'status', label: 'Status', fmt: (v) => ui.pill(v.toUpperCase(), pill[v]), w: '90px' }, { key: 'name', label: 'Check', w: '230px' }, { key: 'detail', label: 'Result', cls: 'wrap' }], rows: ck, search: (r) => r.name + ' ' + r.detail, placeholder: 'Search checks…' }))));

      /* coverage matrix */
      const covCols = [['results', 'Race results'], ['sprint', 'Sprint results'], ['quali', 'Qualifying'], ['laps', 'Lap times'], ['pits', 'Pit stops'], ['dstd', 'Driver standings'], ['cstd', 'Constructor standings'], ['cres', 'Constructor results']];
      const expected = (k, r) => (k === 'sprint' ? (M.seasons.get(+r.year) || { sprints: 0 }).sprints : +r.sched);
      wrap.append(h('div', { class: 'sec-h' }, 'Coverage by season'));
      wrap.append(h('div', { class: 'row' }, F1.chartCard({ title: 'Share of scheduled races with rows, by table and season', src: 'dq_coverage', def: 'For each season and table: races with at least one row ÷ races on the calendar (sprint results: ÷ races with a sprint). Dark/empty = no rows at all — missing coverage, not zero results.', note: 'Hover a cell for counts. Click to filter to a season.' }, (host, setTitle) => {
        const first = (k) => d3.min(cv.filter((r) => +r[k] > 0), (r) => +r.year);
        setTitle(`Race results cover every season; qualifying starts in ${first('quali')}, lap times in ${first('laps')} and pit stops in ${first('pits')}`);
        host.append(ui.legend([{ name: 'No rows', color: '#171c24' }, { name: 'Partial', color: '#2f6f93' }, { name: 'Full coverage', color: '#56B4E9' }]));
        const c = h('div'); host.append(c);
        const cells = []; const ys = cv.map((r) => +r.year);
        covCols.forEach(([k, label], yi) => cv.forEach((r, xi) => { const n = +r[k], sch = expected(k, r), v = sch ? Math.min(1, n / sch) : 0; cells.push({ xi, yi, v: n ? v : null, year: +r.year, tip: ui.tipBody(`${label} · ${r.year}`, [[k === 'sprint' ? 'Races with rows (of sprint weekends)' : 'Races with rows', `${n} of ${sch}`], ['Coverage', sch ? fmt.p0(n / sch) : '—']]) }); }));
        charts.heat(c, { xs: ys.map(String), ys: covCols.map((x) => x[1]), cells, color: ui.ramp(1), xLabel: 'Season', cellH: 24, onClick: (cell) => F1.pick({ y0: cell.year, y1: cell.year }), aria: 'Coverage matrix by season and table' });
      })));
      const firstLast = covCols.map(([k, label]) => { const yrs = cv.filter((r) => +r[k] > 0).map((r) => +r.year); const full = cv.filter((r) => expected(k, r) > 0 && +r[k] >= expected(k, r)).map((r) => +r.year); return { label, first: d3.min(yrs), last: d3.max(yrs), seasons: yrs.length, full: full.length, partial: yrs.length - full.length }; });
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Where each table starts and ends', note: 'Partial = seasons with rows for some but not all scheduled races.', src: 'dq_coverage' }, ui.table({ cols: [{ key: 'label', label: 'Table' }, { key: 'first', label: 'First season', num: true }, { key: 'last', label: 'Last season', num: true }, { key: 'seasons', label: 'Seasons with rows', num: true }, { key: 'full', label: 'Fully covered', num: true }, { key: 'partial', label: 'Partial', num: true }], rows: firstLast, sort: { key: 'first', dir: 'asc' } }))));

      /* tables + nulls */
      wrap.append(h('div', { class: 'sec-h' }, 'Tables and missing values'));
      wrap.append(h('div', { class: 'row r2' },
        ui.card({ title: 'Loaded tables', note: 'Raw row counts, keys and year ranges (races/seasons: calendar years; fact tables: year of their races).', src: 'dq_tables' }, ui.table({ id: 'tbl-tables', cols: [{ key: 'table', label: 'Table' }, { key: 'rows', label: 'Rows', num: true, fmt: (v) => fmt.int(+v), val: (r) => +r.rows }, { key: 'cols', label: 'Cols', num: true, val: (r) => +r.cols }, { key: 'key', label: 'Primary key', cls: 'mut' }, { key: 'dupKeys', label: 'Dup keys', num: true, val: (r) => +r.dupKeys, fmt: (v) => (v ? ui.pill(fmt.int(v), 'warn') : '0') }, { key: 'y0', label: 'Years', val: (r) => (r.y0 ? +r.y0 : null), fmt: (v, r) => (r.y0 ? `${r.y0}–${r.y1}` : 'dimension') }, { key: 'nullCells', label: 'Null cells', num: true, val: (r) => +r.nullCells, fmt: fmt.int }], rows: tb, sort: { key: 'rows', dir: 'desc' } })),
        ui.card({ title: 'Foreign keys', note: 'Child rows whose key has no parent row.', src: 'dq_fk' }, ui.table({ id: 'tbl-fk', cols: [{ key: 'child', label: 'Child' }, { key: 'col', label: 'Column', cls: 'mut' }, { key: 'parent', label: 'Parent', cls: 'mut' }, { key: 'childRows', label: 'Rows', num: true, val: (r) => +r.childRows, fmt: fmt.int }, { key: 'unmatched', label: 'Unmatched', num: true, val: (r) => +r.unmatched, fmt: (v) => (v ? ui.pill(fmt.int(v), 'bad') : '0') }], rows: typed('dq_fk') || [], sort: { key: 'child', dir: 'asc' }, maxH: '300px' }))));
      const nrows = nl.filter((r) => +r.nulls > 0).map((r) => ({ table: r.table, column: r.column, nulls: +r.nulls, pct: +r.nulls / +r.rows, meaning: NULL_MEANING[r.table + '.' + r.column] || '—' }));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Missing values (source NULL “\\N”)', note: 'Missing stays missing: it is shown as “—” or left out of averages, never converted to 0.', src: 'dq_nulls' }, ui.table({ id: 'tbl-nulls', cols: [{ key: 'table', label: 'Table' }, { key: 'column', label: 'Column' }, { key: 'nulls', label: 'Nulls', num: true, fmt: fmt.int, bar: true }, { key: 'pct', label: '% of rows', num: true, fmt: fmt.p1 }, { key: 'meaning', label: 'What a null means here', cls: 'wrap' }], rows: nrows, sort: { key: 'nulls', dir: 'desc' }, search: (r) => `${r.table} ${r.column} ${r.meaning}`, placeholder: 'Search tables or columns…', maxH: '380px' }))));

      /* official vs recorded */
      const ovr = officialVsRecorded(), differ = ovr.filter((r) => Math.abs(r.diff) > 0.01);
      wrap.append(h('div', { class: 'sec-h' }, 'Official standings vs recorded results'));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Season points: official standings vs sum of race results', note: `${differ.length} of ${ovr.length} completed seasons differ. Differences come from dropped scores, exclusions and shared-points rules; titles always use the official standing.`, def: 'Official = sum of every driver’s final-standing points. Recorded = sum of race + sprint result points for the season.', src: 'std_drivers fact_results fact_sprints' },
        ui.table({ id: 'tbl-ovr', cols: [{ key: 'y', label: 'Season', num: true }, { key: 'off', label: 'Official (standings)', num: true, fmt: fmt.pts }, { key: 'rec', label: 'Recorded (results)', num: true, fmt: fmt.pts }, { key: 'diff', label: 'Recorded − official', num: true, fmt: (v) => (Math.abs(v) < 0.01 ? '0' : fmt.signed(v)) }], rows: ovr, sort: { key: 'diff', dir: 'desc' }, maxH: '320px', search: (r) => '' + r.y, placeholder: 'Search season…' }))));

      /* status mapping */
      const byStatus = d3.rollup(M.results, (v) => v.length, (x) => x.si);
      const srows = [...M.status.values()].map((s) => ({ id: +s.id, status: s.status, group: s.group, n: byStatus.get(+s.id) || 0 }));
      const gsum = F1.SG.map((l, i) => ({ g: i, label: l, n: M.results.filter((x) => x.s === i).length }));
      wrap.append(h('div', { class: 'sec-h' }, 'Metric rules'));
      wrap.append(h('div', { class: 'row r2' },
        ui.card({ title: 'Status groups', note: 'Every result is assigned to one group. Rows with positionText F/W (did not qualify / prequalify / withdrawn) are “Did not start”; D/E are “Disqualified”.', src: 'dim_status fact_results' },
          h('div', null, charts && (() => { const d = h('div'); queueMicrotask(() => charts.hbars(d, { items: gsum.map((x) => ({ id: x.g, label: x.label, value: x.n, text: fmt.int(x.n), color: sgColor[x.g] })) })); return d; })()),
          h('p', { class: 'note mut' }, 'Starts = all groups except “Did not start”. DNF = mechanical + accident + other. Disqualified and lapped finishes are not DNFs.')),
        ui.card({ title: 'statusId → group lookup', note: 'Search any status to see its group and how many results use it.', src: 'dim_status' }, ui.table({ id: 'tbl-status', cols: [{ key: 'id', label: 'ID', num: true }, { key: 'status', label: 'Status' }, { key: 'group', label: 'Group', fmt: (v) => h('span', null, h('i', { class: 'sw', style: { background: sgColor[v] } }), F1.SG[v]), val: (r) => r.group }, { key: 'n', label: 'Results', num: true, fmt: fmt.int }], rows: srows, sort: { key: 'n', dir: 'desc' }, search: (r) => `${r.status} ${F1.SG[r.group]}`, placeholder: 'Search status…', maxH: '320px' }))));

      /* constructor identity */
      const crows = [...M.cons.values()].filter((c) => M.span.c.has(c.id)).map((c) => { const sp = M.span.c.get(c.id); return { id: c.id, name: c.name, nat: c.nat, y0: sp[0], y1: sp[1] }; });
      const related = ['Toleman', 'Benetton', 'Renault', 'Lotus F1', 'Alpine F1 Team', 'Force India', 'Racing Point', 'Aston Martin', 'Sauber', 'BMW Sauber', 'Alfa Romeo', 'Toro Rosso', 'AlphaTauri', 'RB F1 Team', 'Minardi', 'Jordan', 'Midland', 'Spyker', 'Stewart', 'Jaguar', 'Red Bull', 'BAR', 'Honda', 'Brawn', 'Mercedes', 'Tyrrell', 'Audi', 'Cadillac'].map((n) => crows.find((c) => c.name === n)).filter(Boolean);
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Constructor identity and renames', note: 'The dataset has no lineage field, so every constructorId is its own team. Related names are listed so you can read them together; nothing is merged or summed across IDs.', src: 'dim_constructors fact_results' },
        h('p', { class: 'note mut' }, 'Spans of IDs often associated with the same entity (external knowledge — shown for reading only): ' + related.map((c) => `${c.name} ${c.y0}–${c.y1}`).join(' · ')),
        ui.table({ id: 'tbl-cons-id', cols: [{ key: 'name', label: 'Constructor ID name' }, { key: 'nat', label: 'Nation', cls: 'mut' }, { key: 'y0', label: 'First season', num: true }, { key: 'y1', label: 'Last season', num: true }], rows: crows, sort: { key: 'y0', dir: 'asc' }, search: (r) => `${r.name} ${r.nat}`, placeholder: 'Search constructors…', maxH: '320px' }))));

      /* known gaps */
      const lapY = firstLast.find((x) => x.label === 'Lap times'), pitY = firstLast.find((x) => x.label === 'Pit stops'), qY = firstLast.find((x) => x.label === 'Qualifying'), sY = firstLast.find((x) => x.label === 'Sprint results'), cY = firstLast.find((x) => x.label === 'Constructor standings');
      wrap.append(h('div', { class: 'sec-h' }, 'Known gaps and treatments'));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Read this before comparing eras', src: 'dq_coverage dq_tables' }, h('ul', { class: 'insights' },
        h('li', null, `Lap times cover ${lapY.first}–${lapY.last} (${lapY.partial} seasons partial); pit stops ${pitY.first}–${pitY.last}; qualifying ${qY.first}–${qY.last} with ${qY.partial} partial seasons; sprints ${sY.first}–${sY.last}.`, h('small', null, 'Dataset ranges differ from commonly quoted ones; the page uses what is actually present.')),
        h('li', null, `Constructors’ standings begin in ${cY.first}; no constructors’ titles exist before that.`),
        h('li', null, 'Points systems changed repeatedly. Every season keeps its own recorded points; the era-normalised metric divides by points available in the races contested.', h('small', null, 'Winner’s points are used as the per-race ceiling, so fastest-lap bonuses not taken by the winner are not in the ceiling.')),
        h('li', null, 'Constructor IDs are not merged across renames (see above). Team-lineage analysis would need an external mapping.'),
        h('li', null, `Seasons with missing races: ${M.years.filter((y) => !M.seasons.get(y).complete).map((y) => `${y} (${M.seasons.get(y).held}/${M.seasons.get(y).sched})`).join(', ') || 'none'}. Titles are never awarded for these.`),
        h('li', null, 'Pit-stop duration is time in the pit lane (entry to exit; typically 15–30 s in recent seasons) — stationary tyre-change times are not in the data. Stops over 60 s are reported separately, and a few values are outliers (for example the fastest 2026 value is about 5 s below the next-fastest stop of its race).'),
        h('li', null, 'Fastest-lap rank is only stored for part of the results, so fastest-lap counts understate older seasons.')))));
      return wrap;
    },
  };
})();
