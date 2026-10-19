/* F1 Evolution - pages: Overview, Driver Intelligence, Constructor Analysis */
(function () {
  'use strict';
  const F1 = window.F1, ui = F1.ui, h = ui.h, fmt = F1.fmt, charts = F1.charts;

  /* ------------------------------------------------------------------ metric definitions (shown in tooltips) */
  const DEF = (F1.DEF = {
    gp: 'Grands Prix: distinct races with recorded results inside the current filters. Scheduled races without results are never counted.',
    drivers: 'Drivers: distinct drivers with at least one race start in the selection.',
    cons: 'Constructors: distinct constructor IDs with at least one race start. Renamed teams (e.g. Toleman → Benetton → Renault → Alpine) keep separate IDs in this dataset and are NOT merged.',
    circuits: 'Circuits: distinct circuit IDs that hosted a race with results in the selection.',
    wins: 'Race victories: results with classified position 1 in a Grand Prix (sprints excluded). Three shared-drive races credit two drivers, so credits can exceed the number of races. A victory is not a title.',
    titles: 'Drivers’ championship titles: final-standing position 1 after the last race of a COMPLETED season (driver_standings). Never inferred from wins and never awarded for a partial season. Not defined under a circuit filter.',
    starts: 'Race starts: result rows where the car took the start. Excludes did-not-qualify / did-not-prequalify / withdrawn / 107% rows. A start is not a classified finish.',
    classified: 'Classified finishes: starts with an official classified position (not retired / not classified / disqualified).',
    podiums: 'Podiums: classified position 1–3.',
    poles: 'Poles: starts from race-grid slot 1 (results.grid). The race grid can differ from qualifying P1 after penalties; qualifying-table poles (1994+, partial early coverage) are on the Qualifying page. Grid 0 (pit-lane / unrecorded) is never counted as a pole.',
    winPct: 'Win % = wins ÷ race starts.',
    podPct: 'Podium % = podiums ÷ race starts.',
    poleRate: 'Pole rate = poles ÷ race starts.',
    conv: 'Pole-to-win conversion = races won from grid slot 1 ÷ poles.',
    dnfRate: 'DNF rate = (mechanical + accident + other retirements) ÷ starts. Disqualifications and lapped finishes are not DNFs. Status groups are mapped from statusId (see Data Quality).',
    mechRate: 'Mechanical DNF rate = statusId mapped to a technical failure ÷ starts.',
    accRate: 'Accident DNF rate = accident / collision / spun-off statuses ÷ starts.',
    avgFin: 'Average finishing position: mean of classified positions only (retirements excluded, so it is flattering for unreliable cars).',
    avgGrid: 'Average grid position: mean race-grid slot over starts with a recorded slot ≥ 1.',
    gain: 'Positions gained = grid − classified finish, averaged over classified starts with a recorded grid slot. Positive = moved forward.',
    pts: 'Recorded points: race + sprint points exactly as stored for each season’s own scoring system (no modern re-scoring). Official championship totals can differ in seasons with dropped scores or exclusions.',
    norm: 'Era-normalised points = points scored ÷ points a car winning every race it started would have scored (sum of the race winner’s recorded points, plus sprint-winner points, over the races started). Comparable across scoring systems; approximate where fastest-lap bonuses were not taken by the winner or points were shared.',
    di: 'Dominance Index = win share × points share within a season (each 0–1): wins ÷ races held, times points ÷ all points scored that season by every entry.',
    fl: 'Fastest laps: results where the stored fastest-lap rank = 1 (rank is only recorded in part of the data).',
    seasons: 'Seasons: distinct seasons with at least one start.',
  });

  F1.dynTitle = function () {
    const s = F1.state, bits = [];
    let subj = 'Formula 1';
    if (s.driver && s.cons) subj = `${F1.name.driver(s.driver)} at ${F1.name.cons(s.cons)}`;
    else if (s.driver) subj = F1.name.driver(s.driver);
    else if (s.cons) subj = F1.name.cons(s.cons);
    if (s.circuit) bits.push('at ' + F1.name.circuit(s.circuit));
    return [subj, ...bits].join(' ') + ', ' + F1.rangeLabel(s);
  };
  const driverCell = (id) => h('span', null, F1.name.driver(id));
  const link = (kind, id, label) => h('button', { type: 'button', class: 'btn ghost', style: { height: 'auto', padding: '0', border: 0, color: 'inherit', textAlign: 'left' }, onclick: (e) => { e.stopPropagation(); F1.pick({ [kind]: id }); } }, label);
  const nameLink = (kind, id) => link(kind, id, kind === 'driver' ? F1.name.driver(id) : F1.name.cons(id));

  /* Dominance Index per driver-season for a row set */
  F1.dominance = function (rows, sprints, byKey) {
    const M = F1.M, key = byKey || ((x) => x.d);
    const season = new Map(), racesIn = new Map();
    rows.forEach((x) => { if (x.s === 6) return; const t = season.get(x.y) || { pts: 0 }; t.pts += x.pt; season.set(x.y, t); (racesIn.get(x.y) || racesIn.set(x.y, new Set()).get(x.y)).add(x.r); });
    sprints.forEach((x) => { const t = season.get(x.y); if (t) t.pts += x.pt; });
    const g = F1.groupAgg(rows, (x) => key(x) + '|' + x.y, sprints), out = [];
    g.forEach((a, k) => {
      if (!a.starts) return;
      const [id, y] = k.split('|'), s = season.get(+y), nr = racesIn.get(+y).size, S = M.seasons.get(+y);
      const winShare = a.wins / nr, ptsShare = s.pts ? a.totalPts / s.pts : 0;
      out.push({ id, year: +y, wins: a.wins, winShare, ptsShare, di: winShare * ptsShare, partial: !S.complete, a });
    });
    return out.sort((p, q) => q.di - p.di);
  };

  /* ================================================================== OVERVIEW */
  const LB = {
    wins: { label: 'Wins', get: (a) => a.wins, f: fmt.int },
    podiums: { label: 'Podiums', get: (a) => a.podiums, f: fmt.int },
    poles: { label: 'Poles', get: (a) => a.poles, f: fmt.int },
    titles: { label: 'Titles', get: (a) => a.titles, f: fmt.int },
    pts: { label: 'Points', get: (a) => a.totalPts, f: fmt.pts },
    starts: { label: 'Starts', get: (a) => a.starts, f: fmt.int },
  };
  /* ---- period comparison + sparkline helpers (selection vs the preceding equal-length window) */
  function seasonCounts(st) {
    const out = new Map();
    F1.rows(st).forEach((x) => {
      if (x.s === 6) return;
      let e = out.get(x.y);
      if (!e) { e = { races: new Set(), d: new Set(), c: new Set(), ci: new Set(), starts: 0, wins: 0 }; out.set(x.y, e); }
      e.races.add(x.r); e.d.add(x.d); e.c.add(x.c); e.ci.add(x.ci); e.starts++; if (x.p === 1) e.wins++;
    });
    return out;
  }
  function prevWindow(s) {
    const len = s.y1 - s.y0 + 1, y0 = s.y0 - len;
    return y0 < F1.M.minYear ? null : Object.assign({}, s, { y0, y1: s.y0 - 1 });
  }
  function totalsFor(st) {
    const a = F1.aggregate(F1.rows(st)), d = new Set(), c = new Set(), ci = new Set();
    F1.rows(st).forEach((x) => { if (x.s !== 6) { d.add(x.d); c.add(x.c); ci.add(x.ci); } });
    const tt = F1.titles(st);
    return { races: a.races, drivers: d.size, cons: c.size, circuits: ci.size, wins: a.wins, titles: tt.driverNA ? null : tt.drivers.length };
  }
  const pctDelta = (cur, prev, ref) => (prev ? { text: `${cur >= prev ? '+' : '−'}${Math.abs(Math.round((100 * (cur - prev)) / prev))}%`, dir: cur > prev ? 'up' : cur < prev ? 'down' : 'flat', ref } : null);

  function lbCard(kind, ps) {
    const key = kind === 'driver' ? 'lbD' : 'lbC', metric = ps[key];
    return F1.chartCard({
      title: kind === 'driver' ? 'Driver leaderboard' : 'Constructor leaderboard', src: 'fact_results fact_sprints std_drivers std_constructors dim_drivers dim_constructors',
      note: `Top 10 by ${LB[metric].label.toLowerCase()}. Click a name to filter the whole dashboard. Blue = leader, red = selected.`,
      def: DEF[metric === 'pts' ? 'pts' : metric] || DEF.wins,
      actions: ui.seg({ label: 'Leaderboard metric', value: metric, options: Object.keys(LB).map((k) => ({ id: k, label: LB[k].label })), onChange: (v) => { ps[key] = v; F1.go(); } }),
    }, (host, setTitle) => {
      const list = F1.leaderboard(kind, F1.state, kind === 'driver' ? 'driver' : 'cons');
      if (metric === 'titles' && list.titlesNA) { host.replaceChildren(ui.empty('Titles are season-level', 'Not defined under a circuit' + (kind === 'cons' ? ' or driver' : '') + ' filter.')); return; }
      const m = LB[metric], top = list.filter((a) => m.get(a) > 0).sort((a, b) => m.get(b) - m.get(a) || b.wins - a.wins).slice(0, 10);
      const sel = kind === 'driver' ? F1.state.driver : F1.state.cons;
      charts.hbars(host, {
        items: top.map((a) => ({ id: a.id, label: a.name, sub: a.y0 === a.y1 ? '' + a.y0 : `${a.y0}–${a.y1}`, value: m.get(a), text: m.f(m.get(a)), selected: a.id === sel, hi: a === top[0] })),
        onClick: (it) => F1.pick({ [kind === 'driver' ? 'driver' : 'cons']: it.id === sel ? null : it.id }),
      });
      if (top.length) setTitle(`${top[0].name} leads in ${m.label.toLowerCase()} (${m.f(m.get(top[0]))})${top[1] ? `, ahead of ${top[1].name} (${m.f(m.get(top[1]))})` : ''}`);
      if (!top.length) host.replaceChildren(ui.empty('Nothing to rank', 'No ' + m.label.toLowerCase() + ' in this selection.'));
    });
  }

  function evolutionCard(ps) {
    const s = F1.state;
    const opts = [['races', 'Grands Prix'], ['starts', 'Starts'], ['drivers', 'Drivers'], ['cons', 'Constructors'], ['wins', 'Wins'], ['dnf', 'DNF rate']]
      .filter(([k]) => !(k === 'drivers' && s.driver) && !(k === 'cons' && s.cons));
    if (!opts.some(([k]) => k === ps.evo)) ps.evo = 'races';
    const defs = { races: DEF.gp, starts: DEF.starts, drivers: DEF.drivers, cons: DEF.cons, wins: DEF.wins, dnf: DEF.dnfRate };
    return F1.chartCard({
      title: 'Evolution by season', src: 'fact_results fact_races', def: defs[ps.evo],
      note: 'Click a season to drill into it. Hatched bars are partial seasons.',
      actions: ui.seg({ label: 'Evolution metric', value: ps.evo, options: opts.map(([id, label]) => ({ id, label })), onChange: (v) => { ps.evo = v; F1.go(); } }),
    }, (host, setTitle) => {
      const rows = F1.rows(F1.state), g = F1.groupAgg(rows, (x) => x.y);
      const dset = new Map(), cset = new Map();
      rows.forEach((x) => { if (x.s === 6) return; (dset.get(x.y) || dset.set(x.y, new Set()).get(x.y)).add(x.d); (cset.get(x.y) || cset.set(x.y, new Set()).get(x.y)).add(x.c); });
      const data = [];
      for (let y = s.y0; y <= s.y1; y++) {
        const S = F1.M.seasons.get(y), a = g.get(y); if (!a || !a.starts) continue;
        const v = ps.evo === 'races' ? a.races : ps.evo === 'starts' ? a.starts : ps.evo === 'drivers' ? dset.get(y).size : ps.evo === 'cons' ? cset.get(y).size : ps.evo === 'wins' ? a.wins : a.dnfRate;
        data.push({ k: y, label: '' + y, v, partial: !S.complete, tip: [['Races held', `${S.held} of ${S.sched} scheduled`], ['Starts', fmt.int(a.starts)]] });
      }
      if (!data.length) { host.replaceChildren(ui.empty('No seasons in this selection')); return; }
      const lab = opts.find(([k]) => k === ps.evo)[1], f = ps.evo === 'dnf' ? fmt.p0 : d3.format(','), what = { races: 'Races per season', starts: 'Car starts per season', drivers: 'Drivers per season', cons: 'Constructors per season', wins: 'Wins per season', dnf: 'The retirement rate' }[ps.evo];
      const comp = data.filter((d) => !d.partial), lastC = comp[comp.length - 1] || data[data.length - 1], notes = [];
      if (data.length >= 2) setTitle(ui.changeTitle(what, { x: data[0].k, v: data[0].v }, { x: lastC.k, v: lastC.v }, f));
      if (comp.length >= 4) {
        const pk = comp.reduce((a, b) => (b.v > a.v ? b : a)), drop = comp.map((d, i) => (i ? { d, r: comp[i - 1].v ? (d.v - comp[i - 1].v) / comp[i - 1].v : 0, abs: d.v - comp[i - 1].v } : null)).filter(Boolean).reduce((a, b) => (b.abs < a.abs ? b : a));
        if (pk.k !== lastC.k) notes.push({ k: pk.k, text: `Peak ${f(pk.v)} (${pk.k})` });
        if (drop.r <= -0.1 && drop.d.k !== pk.k) notes.push({ k: drop.d.k, text: `${drop.d.k}: ${f(drop.d.v)} (${Math.round(100 * drop.r)}%)` });
      }
      charts.columns(host, { data, height: 360, name: lab, yTitle: lab + (ps.evo === 'dnf' ? ' (share of starts)' : ' per season'), xTitle: 'Season', annotate: notes, y: { fmt: f }, valFmt: ps.evo === 'dnf' ? fmt.p1 : fmt.int, onClick: (d) => F1.pick({ y0: d.k, y1: d.k }), selected: (k) => (s.y0 === s.y1 ? k === s.y0 : null), aria: 'Evolution by season' });
    });
  }

  /* ---- story-first Overview: one data-derived Big Idea, three pieces of evidence, one so-what */
  function decadeStory() {
    const st = { y0: F1.state.y0, y1: F1.state.y1, driver: null, cons: null, circuit: null }, out = [];
    d3.group(F1.rows(st), (x) => Math.floor(x.y / 10) * 10).forEach((rs, dec) => {
      const yrs = new Set(rs.map((x) => x.y)); if (yrs.size < 3) return;
      const a = F1.aggregate(rs), wins = d3.rollups(rs.filter((x) => x.p === 1), (v) => v.length, (x) => x.d).sort((p, q) => q[1] - p[1]), tw = d3.sum(wins, (w) => w[1]);
      out.push({ dec, label: dec + 's', dnf: a.dnfRate, conv: a.poles >= 10 ? a.conv : null, top: tw ? wins[0][1] / tw : null, topName: wins[0] ? F1.name.driver(wins[0][0]) : '', partial: [...yrs].some((y) => !F1.M.seasons.get(y).complete) });
    });
    return out.sort((p, q) => p.dec - q.dec);
  }
  function storyBlock() {
    const s = F1.state;
    if (s.driver || s.cons || s.circuit) return null;
    const d = decadeStory();
    if (d.length < 3 || d[0].conv == null || d[d.length - 1].conv == null) return null;
    const f = d[0], l = d[d.length - 1], fixes = l.dnf < f.dnf * 0.75 && l.conv > f.conv + 0.05;
    const big = fixes
      ? h('p', { class: 'story-big' }, 'As cars stopped breaking, the grid decided more of the race: a pole now converts to a win ', h('b', null, fmt.p0(l.conv)), ' of the time, up from ', fmt.p0(f.conv), '.')
      : h('p', { class: 'story-big' }, `Between the ${f.label} and the ${l.label}, retirements went from ${fmt.p0(f.dnf)} to ${fmt.p0(l.dnf)} of starts and pole-to-win conversion from ${fmt.p0(f.conv)} to ${fmt.p0(l.conv)}.`);
    const card = (title, note, series, fm, yTitle) => {
      const host = h('div', { class: 'host' }), c = h('div', { class: 'story-card', 'data-source': 'fact_results fact_races' }, h('h3', null, title), h('p', { class: 'note' }, note), host);
      queueMicrotask(() => { try { charts.columns(host, { data: d.map((x) => ({ k: x.dec, label: x.label, v: series(x), partial: x.partial, tip: [['Leader', x.topName]] })), height: 190, y: { fmt: fm }, valFmt: fm, yTitle, tickEvery: 1, highlight: (x) => x.k === l.dec, annotate: [{ k: f.dec, text: fm(series(f)) }, { k: l.dec, text: fm(series(l)) }], aria: title }); } catch (e) { host.replaceChildren(ui.empty('Chart unavailable')); } });
      return c;
    };
    const wrap = h('div', { class: 'story' }, big,
      h('p', { class: 'story-sub' }, `Three views of the same shift, decade by decade (${F1.rangeLabel(s)}). The first and last decades are highlighted; hatched = partial decade. This is an association across eras, not proof that reliability caused it.`),
      h('div', { class: 'story-row' },
        card(ui.changeTitle('Retirements', { x: f.label, v: f.dnf }, { x: l.label, v: l.dnf }, fmt.p0), 'Share of starts ending in a mechanical, accident or other retirement.', (x) => x.dnf, fmt.p0, 'Share of starts retired'),
        card(ui.changeTitle('A pole’s chance of winning', { x: f.label, v: f.conv }, { x: l.label, v: l.conv }, fmt.p0), 'Race-grid poles that became wins.', (x) => x.conv, fmt.p0, 'Poles converted to wins'),
        card(ui.changeTitle('The top driver’s share of wins', { x: f.label, v: f.top }, { x: l.label, v: l.top }, fmt.p0), `Wins by the decade’s most successful driver (${l.label}: ${l.topName}).`, (x) => x.top, fmt.p0, 'Share of the decade’s wins')),
      h('p', { class: 'story-recap' }, h('b', null, 'So what: '), `a pole carries more information about the winner than it did when mechanical failure was the main filter — so compare eras on rates, not raw counts, and read modern results with the grid in mind.`));
    return wrap;
  }

  function overviewHeadline(all, rows) {
    const s = F1.state, dl = F1.leaderboard('driver', s, 'driver');
    if (!all.starts) return null;
    if (s.driver || s.cons) return `${F1.dynTitle().replace(/, \d{4}.*$/, '')}: ${fmt.int(all.wins)} win${all.wins === 1 ? '' : 's'} from ${fmt.int(all.starts)} starts (${fmt.p1(all.winPct)}), ${fmt.int(all.podiums)} podiums, ${fmt.p0(all.dnfRate)} retirement rate.`;
    const top = dl.slice().sort((a, b) => b.wins - a.wins)[0], winners = new Set(rows.filter((x) => x.p === 1).map((x) => x.d)).size;
    return top && top.wins ? `${top.name} leads with ${top.wins} wins; ${winners} different drivers have won ${fmt.int(all.races)} Grands Prix.` : null;
  }
  function driverHeadline(did) {
    const s = F1.state;
    if (!did) { const dl = F1.leaderboard('driver', s, 'driver'), top = dl.slice().sort((a, b) => b.wins - a.wins)[0]; return top ? `${fmt.int(dl.length)} drivers started a race in this selection; ${top.name} leads with ${top.wins} wins from ${fmt.int(top.starts)} starts.` : null; }
    const a = F1.aggregate(F1.rows(s), F1.sprintRows(s)), tt = F1.titles(s), ser = F1.seasonSeries(s).filter((r) => r.a);
    if (!a.starts) return null;
    const best = ser.slice().sort((p, q) => q.a.totalPts - p.a.totalPts)[0];
    return `${F1.name.driver(did)}: ${fmt.int(a.starts)} starts, ${a.wins} wins (${fmt.p1(a.winPct)}), ${a.podiums} podiums${!tt.driverNA && tt.drivers.length ? `, ${tt.drivers.length} title${tt.drivers.length === 1 ? '' : 's'}` : ''}. Best season ${best.year} with ${fmt.pts(best.a.totalPts)} points.`;
  }
  function consHeadline(cid) {
    const s = F1.state;
    if (!cid) { const cl = F1.leaderboard('cons', s, 'cons'), top = cl.slice().sort((a, b) => b.wins - a.wins)[0]; return top ? `${fmt.int(cl.length)} constructors entered a car in this selection; ${top.name} leads with ${top.wins} wins.` : null; }
    const a = F1.aggregate(F1.rows(s), F1.sprintRows(s)), f = F1.aggregate(F1.rows(s, 'cons'), F1.sprintRows(s, 'cons')), tt = F1.titles(s);
    if (!a.starts) return null;
    return `${F1.name.cons(cid)}: ${a.wins} wins and ${tt.consNA ? '—' : tt.cons.length} constructors’ titles; ${fmt.p0(a.dnfRate)} of its starts ended in a retirement vs ${fmt.p0(f.dnfRate)} for the whole field.`;
  }

  function insights() {
    const M = F1.M, s = F1.state, out = [];
    const rows = F1.rows(s), spr = F1.sprintRows(s), all = F1.aggregate(rows, spr);
    if (!all.starts) return [{ t: 'No race starts match the current filters.' }];
    const dl = F1.leaderboard('driver', s, 'driver'), cl = F1.leaderboard('cons', s, 'cons');
    const topW = dl.slice().sort((a, b) => b.wins - a.wins)[0];
    if (topW && topW.wins) out.push({ t: `${topW.name} leads with ${topW.wins} win${topW.wins === 1 ? '' : 's'}`, sub: `${fmt.p1(topW.wins / Math.max(1, d3.sum(dl, (a) => a.wins)))} of all win credits in the selection; win rate ${fmt.p1(topW.winPct)} over ${fmt.int(topW.starts)} starts.` });
    const topC = cl.slice().sort((a, b) => b.wins - a.wins)[0];
    if (topC && topC.wins) out.push({ t: `${topC.name} is the winningest constructor (${topC.wins})`, sub: `Across ${topC.nSeasons} seasons and ${fmt.int(topC.starts)} car starts (${fmt.p1(topC.winPct)} win rate per start).` });
    const winners = new Set(rows.filter((x) => x.p === 1).map((x) => x.d));
    if (!s.driver) { const top10 = d3.sum(dl.slice().sort((a, b) => b.wins - a.wins).slice(0, 10), (a) => a.wins) / Math.max(1, d3.sum(dl, (a) => a.wins)); out.push({ t: `${winners.size} different drivers have won ${fmt.int(all.races)} Grands Prix`, sub: `The ten most successful account for ${fmt.p0(top10)} of all win credits — a measure of how concentrated success is.` }); }
    const tt = F1.titles(s);
    if (!tt.driverNA && tt.drivers.length) {
      const cnt = d3.rollups(tt.drivers, (v) => v.length, (x) => x.d).sort((a, b) => b[1] - a[1])[0];
      out.push({ t: `${F1.name.driver(cnt[0])} holds the most drivers’ titles here (${cnt[1]})`, sub: `${tt.drivers.length} titles decided in completed seasons ${F1.rangeLabel(s)}.` });
    }
    if (all.poles >= 5) out.push({ t: `${fmt.p0(all.conv)} of race-grid poles ended in a win`, sub: `${all.polesWon} wins from ${all.poles} poles; pole rate ${fmt.p1(all.poleRate)} of starts.` });
    const dom = F1.dominance(F1.rows(s, 'driver').filter((x) => !s.cons || x.c === s.cons), F1.sprintRows(s, 'driver').filter((x) => !s.cons || x.c === s.cons)).filter((x) => !x.partial);
    if (dom.length && !s.driver) out.push({ t: `Most dominant season: ${F1.name.driver(dom[0].id)}, ${dom[0].year}`, sub: `Dominance Index ${dom[0].di.toFixed(2)} (${fmt.p0(dom[0].winShare)} of wins × ${fmt.p0(dom[0].ptsShare)} of all points).` });
    const ser = F1.seasonSeries(s).filter((r) => r.a && r.season.complete);
    if (ser.length >= 6) {
      const first = ser.slice(0, 3), last = ser.slice(-3), rate = (xs) => d3.sum(xs, (r) => r.a.dnf) / d3.sum(xs, (r) => r.a.starts);
      out.push({ t: `Retirement rate: ${fmt.p0(rate(first))} in ${first[0].year}–${first[2].year} vs ${fmt.p0(rate(last))} in ${last[0].year}–${last[2].year}`, sub: 'DNF = mechanical + accident + other retirements, as a share of starts, completed seasons only.' });
    }
    if (all.gain != null && all.gainN > 30) out.push({ t: `Classified cars gained ${all.gain >= 0 ? '+' : ''}${all.gain.toFixed(2)} positions on average`, sub: 'Grid minus finish over classified starts with a recorded grid slot (grid 0 excluded).' });
    return out;
  }

  function champions(ps) {
    const M = F1.M, s = F1.state;
    const rows = [];
    for (let y = s.y0; y <= s.y1; y++) {
      const S = M.seasons.get(y), cd = M.champD.get(y), cc = M.champC.get(y); if (!S) continue;
      rows.push({
        year: y, complete: S.complete, held: S.held, sched: S.sched, d: cd ? cd.d : null, dpt: cd ? cd.pt : null, margin: cd ? cd.margin : null, w: cd ? cd.w : null, team: cd ? cd.team : null,
        c: cc ? cc.c : null, cpt: cc ? cc.pt : null,
      });
    }
    return ui.table({
      id: 'tbl-champs', cols: [
        { key: 'year', label: 'Season', num: true, w: '70px', fmt: (v, r) => (r.complete ? v : v + '*'), def: 'Asterisk = partial season: the name shown is the current standings leader, not a champion.' },
        { key: 'd', label: 'Drivers’ champion', val: (r) => (r.d ? F1.name.driver(r.d) : null), fmt: (v, r) => (r.d ? h('span', null, v, r.complete ? h('span', { class: 'gold' }, ' ●') : h('span', { class: 'dim' }, ' (leader)')) : '—'), def: DEF.titles },
        { key: 'team', label: 'Car', val: (r) => (r.team ? F1.name.cons(r.team) : null), def: 'Constructor with which the champion started most races that season.' },
        { key: 'dpt', label: 'Points', num: true, fmt: fmt.pts, def: 'Official final-standing points (may differ from recorded race points where scores were dropped).' },
        { key: 'margin', label: 'Margin', num: true, fmt: fmt.pts, def: 'Points gap between P1 and P2 in the final standings.' },
        { key: 'w', label: 'Wins', num: true, fmt: fmt.int },
        { key: 'c', label: 'Constructors’ champion', val: (r) => (r.c ? F1.name.cons(r.c) : null), fmt: (v, r) => (r.c ? h('span', null, v, r.complete ? '' : h('span', { class: 'dim' }, ' (leader)')) : '—'), def: 'Constructors’ Championship standings begin in 1958 in this dataset; earlier seasons have no table.' },
        { key: 'cpt', label: 'Pts', num: true, fmt: fmt.pts },
        { key: 'held', label: 'Races', num: true, fmt: (v, r) => (r.complete ? v : `${r.held}/${r.sched}`) },
      ],
      rows, search: (r) => `${r.year} ${r.d ? F1.name.driver(r.d) : ''} ${r.c ? F1.name.cons(r.c) : ''} ${r.team ? F1.name.cons(r.team) : ''}`, placeholder: 'Search season, driver, team…',
      sort: { key: 'year', dir: 'desc' }, maxH: '380px', limit: 100, isSel: (r) => !!(s.driver && r.d === s.driver) || !!(s.cons && (r.c === s.cons || r.team === s.cons)),
      onRow: (r) => { F1.ps.races.year = r.year; F1.pick({ y0: r.year, y1: r.year }); F1.navigate('races'); },
    });
  }

  function latestRaces() {
    const M = F1.M, s = F1.state, rows = F1.rows(s);
    const byRace = d3.group(rows, (x) => x.r);
    const list = [...byRace.keys()].map((id) => M.raceById.get(id)).sort((a, b) => b.ord - a.ord).slice(0, 25).map((r) => {
      const all = M.resByRace.get(r.id) || [], win = all.find((x) => x.p === 1);
      const mine = (byRace.get(r.id) || []).filter((x) => x.s !== 6).sort((a, b) => a.o - b.o)[0];
      return { race: r, win, mine };
    });
    const filtered = s.driver || s.cons;
    return ui.table({
      id: 'tbl-latest', cols: [
        { key: 'date', label: 'Date', val: (r) => r.race.date, w: '92px' },
        { key: 'rd', label: 'Rd', num: true, val: (r) => r.race.round, w: '44px' },
        { key: 'gp', label: 'Grand Prix', val: (r) => r.race.name + ' ' + r.race.year },
        { key: 'circ', label: 'Circuit', val: (r) => F1.name.circuit(r.race.circuit) },
        { key: 'win', label: 'Winner', val: (r) => (r.win ? F1.name.driver(r.win.d) : null) },
        { key: 'team', label: 'Constructor', val: (r) => (r.win ? F1.name.cons(r.win.c) : null) },
        { key: 'grid', label: 'Win grid', num: true, val: (r) => (r.win && r.win.g >= 1 ? r.win.g : null), def: 'Grid slot the winner started from; blank = not recorded.' },
        filtered ? { key: 'mine', label: 'Selection best', num: true, val: (r) => (r.mine ? r.mine.o : null), fmt: (v) => (v == null ? '—' : 'P' + v), def: 'Best positionOrder achieved by the selected driver / constructor in that race.' } : null,
      ].filter(Boolean),
      rows: list, search: (r) => `${r.race.name} ${r.race.year} ${F1.name.circuit(r.race.circuit)} ${r.win ? F1.name.driver(r.win.d) : ''}`, placeholder: 'Search race, circuit, winner…',
      sort: { key: 'date', dir: 'desc' }, maxH: '360px',
      onRow: (r) => { F1.ps.races.year = r.race.year; F1.ps.races.race = r.race.id; F1.navigate('races'); },
    });
  }

  F1.pages.overview = {
    needs: [],
    render() {
      const ps = (F1.ps.overview = Object.assign({ evo: 'races', lbD: 'wins', lbC: 'wins' }, F1.ps.overview));
      const s = F1.state, rows = F1.rows(s), spr = F1.sprintRows(s);
      const all = F1.aggregate(rows, spr), tt = F1.titles(s);
      const dset = new Set(), cset = new Set(), ciset = new Set();
      rows.forEach((x) => { if (x.s === 6) return; dset.add(x.d); cset.add(x.c); ciset.add(x.ci); });
      const wrap = h('div');
      const story = storyBlock();
      F1.nextHeadline = story ? null : overviewHeadline(all, rows);
      wrap.append(F1.pageHead('Overview', F1.dynTitle(), 'Every Grand Prix in the dataset, from the first World Championship season to the latest recorded race. All figures follow the filters above.'));
      if (!all.starts) { wrap.append(ui.empty('No race starts match these filters', 'Widen the season range or clear a driver / constructor / circuit filter.')); return wrap; }
      if (story) wrap.append(story);
      wrap.append(h('div', { class: 'sec-h' }, 'Context: the scale of the selection'));
      const extra = all.wins - all.races;
      const pw = prevWindow(s), prev = pw ? totalsFor(pw) : null, ref = pw ? 'vs ' + F1.rangeLabel(pw) : '';
      const sc = s.y1 - s.y0 >= 3 ? seasonCounts(s) : null, sp = (f) => (sc ? d3.range(s.y0, s.y1 + 1).map((y) => (sc.get(y) ? f(sc.get(y)) : null)) : null);
      const tDelta = prev && prev.titles != null && !tt.driverNA ? { text: `${tt.drivers.length >= prev.titles ? '+' : '−'}${Math.abs(tt.drivers.length - prev.titles)}`, dir: tt.drivers.length > prev.titles ? 'up' : tt.drivers.length < prev.titles ? 'down' : 'flat', ref } : null;
      const kp = h('div', { class: 'kpis', 'data-source': 'fact_results fact_races std_drivers std_constructors' },
        ui.kpi({ label: 'Grands Prix', value: fmt.int(all.races), def: DEF.gp, sub: `${fmt.int(all.starts)} car starts`, delta: prev && pctDelta(all.races, prev.races, ref), spark: sp((e) => e.races.size) }),
        ui.kpi({ label: 'Drivers', value: fmt.int(dset.size), def: DEF.drivers, sub: s.driver ? 'selected driver' : 'with ≥1 start', delta: prev && !s.driver ? pctDelta(dset.size, prev.drivers, ref) : null, spark: sp((e) => e.d.size) }),
        ui.kpi({ label: 'Constructors', value: fmt.int(cset.size), def: DEF.cons, sub: 'IDs not merged across renames', delta: prev && !s.cons ? pctDelta(cset.size, prev.cons, ref) : null, spark: sp((e) => e.c.size) }),
        ui.kpi({ label: 'Circuits', value: fmt.int(ciset.size), def: DEF.circuits, sub: 'with ≥1 race', delta: prev && !s.circuit ? pctDelta(ciset.size, prev.circuits, ref) : null, spark: sp((e) => e.ci.size) }),
        ui.kpi({ label: 'Victories', value: fmt.int(all.wins), def: DEF.wins, accent: 'red', delta: prev && pctDelta(all.wins, prev.wins, ref), spark: sp((e) => e.wins), sparkColor: ui.RED, sub: s.driver || s.cons ? `${fmt.p1(all.winPct)} of starts` : extra > 0 ? `${fmt.int(all.races)} races + ${extra} shared-drive credit${extra === 1 ? '' : 's'}` : 'one winner per race' }),
        ui.kpi({ label: 'Drivers’ titles', value: tt.driverNA ? '—' : fmt.int(tt.drivers.length), def: DEF.titles, accent: 'gold', delta: tDelta, sub: tt.driverNA ? 'n/a for a circuit filter' : tt.consNA ? 'constructors’ titles: n/a here' : `${tt.cons.length} constructors’ title${tt.cons.length === 1 ? '' : 's'}` }));
      wrap.append(kp);
      const insightCard = ui.card({ title: 'Takeaways for this selection', note: 'Generated only from the rows matching the filters.', src: 'fact_results std_drivers' },
        h('ul', { class: 'insights' }, insights().map((i) => h('li', null, i.t, i.sub ? h('small', null, i.sub) : null))));
      wrap.append(h('div', { class: 'sec-h' }, 'How the sport changed, season by season'));
      wrap.append(h('div', { class: 'row r-ms' }, evolutionCard(ps), insightCard));
      wrap.append(h('div', { class: 'sec-h' }, 'Who won it: the leaders'));
      wrap.append(h('div', { class: 'row r2' }, lbCard('driver', ps), lbCard('cons', ps)));
      wrap.append(h('div', { class: 'sec-h' }, 'Who was champion'));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Champions by season', note: 'Click a season to open it in the Race & Circuit Explorer. Titles come from final standings of completed seasons; the table follows the season range only.', src: 'std_drivers std_constructors fact_results' }, champions(ps))));
      wrap.append(h('div', { class: 'sec-h' }, 'Latest races in the selection'));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Most recent Grands Prix', note: 'Latest 25 races with results; scheduled races without results are not shown.', src: 'fact_results fact_races' }, latestRaces())));
      return wrap;
    },
  };

  /* ================================================================== DRIVER INTELLIGENCE */
  const careerKpis = (a, titles, field, sp) => {
    const mult = field && field.winPct && a.starts >= 5 ? a.winPct / field.winPct : null;
    return h('div', { class: 'kpis' },
      ui.kpi({ label: 'Starts', value: fmt.int(a.starts), def: DEF.starts, sub: `${fmt.int(a.classified)} classified finishes`, spark: sp && sp.starts }),
      ui.kpi({ label: 'Wins', value: fmt.int(a.wins), def: DEF.wins, accent: 'red', delta: mult == null ? null : { text: `${mult.toFixed(1)}× the field win rate`, dir: mult > 1 ? 'up' : mult < 1 ? 'down' : 'flat', good: mult > 1, ref: `(${fmt.p1(field.winPct)})` }, sub: `${fmt.p1(a.winPct)} win rate` }),
      ui.kpi({ label: 'Podiums', value: fmt.int(a.podiums), def: DEF.podiums, sub: `${fmt.p1(a.podPct)} of starts · field ${fmt.p1(field && field.podPct)}` }),
      ui.kpi({ label: 'Poles', value: fmt.int(a.poles), def: DEF.poles, sub: (a.poles ? `${fmt.p0(a.conv)} converted to wins` : `${fmt.p1(a.poleRate)} of starts`) + ` · field ${fmt.p0(field && field.conv)}` }),
      ui.kpi({ label: 'Titles', value: titles == null ? '—' : fmt.int(titles), def: DEF.titles, accent: 'gold', sub: titles == null ? 'n/a here' : 'completed seasons only' }),
      ui.kpi({ label: 'Points', value: fmt.pts(a.totalPts), def: DEF.pts, sub: `${fmt.p0(a.norm)} era-normalised · field ${fmt.p0(field && field.norm)}`, spark: sp && sp.pts }));
  };

  function driverTable() {
    const s = F1.state, list = F1.leaderboard('driver', s, 'driver');
    return ui.table({
      id: 'tbl-drivers', cols: [
        { key: 'name', label: 'Driver', val: (r) => r.name, fmt: (v, r) => h('span', null, v, r.code ? h('span', { class: 'dim' }, ' ' + r.code) : null) },
        { key: 'nat', label: 'Nation', cls: 'mut' },
        { key: 'span', label: 'Active', val: (r) => r.y0, fmt: (v, r) => (r.y0 === r.y1 ? r.y0 : `${r.y0}–${r.y1}`) },
        { key: 'starts', label: 'Starts', num: true, fmt: fmt.int, def: DEF.starts },
        { key: 'wins', label: 'Wins', num: true, bar: true, fmt: fmt.int, def: DEF.wins },
        { key: 'winPct', label: 'Win %', num: true, fmt: fmt.p1, def: DEF.winPct, val: (r) => (r.starts >= 10 ? r.winPct : null) },
        { key: 'podiums', label: 'Podiums', num: true, fmt: fmt.int, def: DEF.podiums },
        { key: 'poles', label: 'Poles', num: true, fmt: fmt.int, def: DEF.poles },
        { key: 'titles', label: 'Titles', num: true, fmt: (v) => (list.titlesNA ? '—' : fmt.int(v)), def: DEF.titles },
        { key: 'totalPts', label: 'Points', num: true, fmt: fmt.pts, def: DEF.pts },
        { key: 'norm', label: 'Era-normalised', num: true, fmt: fmt.p1, def: DEF.norm, val: (r) => (r.starts >= 10 ? r.norm : null) },
        { key: 'avgFin', label: 'Avg fin.', num: true, fmt: fmt.d1, def: DEF.avgFin },
        { key: 'dnfRate', label: 'Retired %', num: true, fmt: fmt.p0, def: DEF.dnfRate },
      ],
      rows: list, search: (r) => `${r.name} ${r.code} ${r.nat}`, placeholder: 'Search drivers by name, code or nationality…', sort: { key: 'wins', dir: 'desc' },
      limit: 25, isSel: (r) => r.id === s.driver, onRow: (r) => F1.pick({ driver: r.id }),
      extra: h('span', { class: 'dim' }, 'Rates need ≥10 starts to rank'),
    });
  }

  function driverTimeline(ps, did) {
    const M = F1.M, s = F1.state;
    const opts = [['pts', 'Points'], ['pos', 'Standing'], ['wins', 'Wins'], ['norm', 'Era-norm. %'], ['fin', 'Avg finish']];
    return F1.chartCard({
      title: 'Season-by-season timeline', src: 'fact_results std_drivers fact_races', def: ps.dtl === 'pos' ? 'Official final championship position after the last race of the season (current standing for a partial season).' : ps.dtl === 'norm' ? DEF.norm : DEF.pts,
      note: 'Click a point to filter to that season.', actions: ui.seg({ label: 'Timeline metric', value: ps.dtl, options: opts.map(([id, label]) => ({ id, label })), onChange: (v) => { ps.dtl = v; F1.go(); } }),
    }, (host, setTitle) => {
      const compare = ps.cmp;
      const mk = (id, idx) => {
        const st2 = Object.assign({}, s, { driver: id });
        const sr = F1.seasonSeries(st2);
        const data = sr.map((r) => {
        if (!r.a) return [r.year, null];   // a gap in the career stays a gap in the line
          const a = r.a, fin = (M.finalD.get(r.year) || []).find((x) => x.k === id);
          const v = ps.dtl === 'pts' ? a.totalPts : ps.dtl === 'wins' ? a.wins : ps.dtl === 'norm' ? (a.norm == null ? null : a.norm * 100) : ps.dtl === 'fin' ? a.avgFin : fin ? fin.po : null;
          return [r.year, v];
        });
        return { name: F1.name.driver(id), data, color: idx === 0 ? ui.C.hi : ui.C.cmp, fmt: ps.dtl === 'norm' ? (v) => v.toFixed(1) + '%' : ps.dtl === 'fin' || ps.dtl === 'pos' ? (v) => 'P' + d3.format('.1f')(v).replace(/\.0$/, '') : fmt.pts };
      };
      const series = [mk(did, 0)].concat(compare && compare !== did ? [mk(compare, 1)] : []);
      const partial = F1.partialYearsIn(s)[0];
      const inv = ps.dtl === 'pos' || ps.dtl === 'fin', lbl = (opts.find(([k]) => k === ps.dtl) || [])[1], bestOf = (ser) => { const v = ser.data.filter((p) => p[1] != null); return v.length ? v.reduce((a, b) => ((inv ? b[1] < a[1] : b[1] > a[1]) ? b : a)) : null; };
      const bests = series.map(bestOf), pf = series[0].fmt;
      const words = { pts: 'scored most', pos: 'finished highest', wins: 'won most', norm: 'peaked at', fin: 'averaged best' }[ps.dtl];
      if (bests[0]) setTitle(series.length > 1 && bests[1] ? `${series[0].name} peaked in ${bests[0][0]}, ${series[1].name} in ${bests[1][0]}` : `${series[0].name} ${words} in ${bests[0][0]} (${pf(bests[0][1])})`);
      charts.line(host, { series, height: 320, endLabels: series.length > 1, yTitle: lbl, xTitle: 'Season', annotate: bests.map((b, i) => (b ? { x: b[0], y: b[1], text: series.length > 1 ? `${series[i].name.split(' ').pop()} ${pf(b[1])}` : `Best: ${pf(b[1])} (${b[0]})`, below: i === 1 || inv } : null)).filter(Boolean), y: { fmt: ps.dtl === 'norm' ? (v) => v + '%' : ps.dtl === 'pos' || ps.dtl === 'fin' ? (v) => 'P' + v : d3.format(','), invert: ps.dtl === 'pos' || ps.dtl === 'fin', zero: !(ps.dtl === 'pos' || ps.dtl === 'fin'), domain: ps.dtl === 'pos' || ps.dtl === 'fin' ? [1, Math.max(6, d3.max(series.flatMap((x) => x.data.map((p) => p[1])), (v) => v) || 6)] : undefined }, partial: partial ? { from: partial.year } : null, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Driver season timeline' });
    });
  }

  function gridFinish(did) {
    const s = F1.state, rows = F1.rows(Object.assign({}, s, { driver: did })).filter((x) => x.s !== 6 && x.g >= 1 && x.p != null);
    return F1.chartCard({ title: 'Grid vs finish', src: 'fact_results', def: DEF.gain, note: `Each cell counts races from that grid slot to that classified finish (${fmt.int(rows.length)} classified starts with a recorded grid slot). Cells below the diagonal are places gained.` }, (host, setTitle) => {
      if (rows.length < 3) { host.replaceChildren(ui.empty('Too few classified starts', 'Needs recorded grid slots and classified finishes.')); return; }
      const maxP = Math.min(20, Math.max(8, d3.max(rows, (x) => Math.max(x.g, x.p)))), cnt = new Map();
      rows.forEach((x) => { if (x.g > maxP || x.p > maxP) return; const k = x.g + '|' + x.p; cnt.set(k, (cnt.get(k) || 0) + 1); });
      const cells = []; let mx = 1;
      cnt.forEach((v, k) => { const [g, p] = k.split('|').map(Number); mx = Math.max(mx, v); cells.push({ xi: g - 1, yi: p - 1, v, tip: ui.tipBody(`Grid P${g} → finish P${p}`, [['Races', v]]) }); });
      const gain = d3.mean(rows, (x) => x.g - x.p);
      setTitle(`${F1.name.driver(did)} finishes ${Math.abs(gain).toFixed(1)} places ${gain >= 0 ? 'ahead of' : 'behind'} the grid slot on average`);
      charts.heat(host, { xs: d3.range(1, maxP + 1).map(String), ys: d3.range(1, maxP + 1).map(String), cells, color: ui.ramp(mx), text: (v) => v, xLabel: 'Grid slot', yLabel: 'Finish position', legend: { max: mx, lo: 'Fewer races', hi: 'More races' }, cellH: 18, height: 380, aria: 'Grid versus finish heatmap' });
    });
  }

  function profileCard(ids) {
    const s = F1.state;
    const stats = ids.map((id) => ({ id, a: F1.aggregate(F1.rows(Object.assign({}, s, { driver: id })), F1.sprintRows(Object.assign({}, s, { driver: id }))) }));
    const metrics = [
      ['Win rate', (a) => a.winPct, fmt.p1], ['Podium rate', (a) => a.podPct, fmt.p1], ['Pole rate', (a) => a.poleRate, fmt.p1], ['Classified-finish rate', (a) => a.finRate, fmt.p0],
      ['Mechanical DNF rate', (a) => a.mechRate, fmt.p1, true], ['Accident DNF rate', (a) => a.accRate, fmt.p1, true], ['Era-normalised points', (a) => a.norm, fmt.p1], ['Avg grid slot', (a) => a.avgGrid, fmt.d1, true], ['Avg classified finish', (a) => a.avgFin, fmt.d1, true], ['Avg positions gained', (a) => a.gain, fmt.signed],
    ];
    const body = h('div', { class: 'stat-pair' });
    if (stats.length === 2) body.append(h('div', { class: 'a mut' }, F1.name.driver(ids[0])), h('div'), h('div', { class: 'b mut' }, F1.name.driver(ids[1])));
    metrics.forEach(([l, f, ff, lower]) => {
      const va = f(stats[0].a), vb = stats[1] ? f(stats[1].a) : null;
      const better = stats[1] && va != null && vb != null && va !== vb ? ((va < vb) === !!lower ? 0 : 1) : -1;
      if (stats.length === 1) { body.style.gridTemplateColumns = '1fr auto'; body.append(h('div', { class: 'mut' }, l), h('div', { class: 'a' }, ff(va))); return; }
      body.append(h('div', { class: 'a' + (better === 0 ? ' win' : '') }, ff(va)), h('div', { class: 'lab' }, l), h('div', { class: 'b' + (better === 1 ? ' win' : '') }, ff(vb)));
    });
    return ui.card({ title: stats.length === 2 ? 'Performance profile — side by side' : 'Performance profile', note: stats.length === 2 ? 'Gold marks the better value on each row (lower is better for DNF, grid and finish).' : 'Rates are per race start.', def: 'Every figure uses the definitions in the column tooltips of the leaderboard.', src: 'fact_results fact_sprints' }, body);
  }

  function teamHistory(did) {
    const s = F1.state, rows = F1.rows(Object.assign({}, s, { driver: did })), spr = F1.sprintRows(Object.assign({}, s, { driver: did }));
    const g = F1.groupAgg(rows, (x) => x.c, spr);
    const list = [...g].filter(([, a]) => a.starts).map(([c, a]) => Object.assign(a, { c, name: F1.name.cons(c), y0: d3.min([...a.seasons]), y1: d3.max([...a.seasons]) }));
    return ui.card({ title: 'Constructor history', note: 'Teams the driver started for within the filters. Click to filter to that pairing.', src: 'fact_results' }, ui.table({
      id: 'tbl-teams', cols: [
        { key: 'name', label: 'Constructor' }, { key: 'y0', label: 'Seasons', fmt: (v, r) => (r.y0 === r.y1 ? r.y0 : `${r.y0}–${r.y1}`) },
        { key: 'starts', label: 'Starts', num: true, fmt: fmt.int }, { key: 'wins', label: 'Wins', num: true, fmt: fmt.int, bar: true }, { key: 'podiums', label: 'Podiums', num: true, fmt: fmt.int },
        { key: 'totalPts', label: 'Points', num: true, fmt: fmt.pts }, { key: 'avgFin', label: 'Avg fin.', num: true, fmt: fmt.d1 },
      ], rows: list, sort: { key: 'y0', dir: 'asc' }, onRow: (r) => F1.pick({ cons: r.c }), isSel: (r) => r.c === s.cons,
    }));
  }

  function h2hCard(a, b) {
    const s = F1.state, r = F1.headToHead(a, b, s);
    const na = F1.name.driver(a), nb = F1.name.driver(b);
    if (!r.shared) return ui.card({ title: 'Head-to-head', src: 'fact_results' }, ui.empty('Never started the same race', `${na} and ${nb} have no common starts in ${F1.rangeLabel(s)}.`));
    const bar = (x, y) => h('div', { class: 'pbar', 'aria-hidden': 'true' }, h('div', { style: { width: (100 * x) / Math.max(1, x + y) + '%', background: ui.PAL[0] } }), h('div', { style: { width: (100 * y) / Math.max(1, x + y) + '%', background: ui.PAL[1] } }));
    return ui.card({ title: 'Head-to-head', def: 'Races both drivers started; “ahead” = lower positionOrder (so a classified finisher is ahead of a retirement, and later retirements rank ahead of earlier ones). Team-mate rows only count races where both drove for the same constructor.', note: `${r.shared} shared races across ${r.years.size} season${r.years.size === 1 ? '' : 's'}.`, src: 'fact_results' },
      h('div', { class: 'stat-pair' },
        h('div', { class: 'a' }, na, h('div', { class: 'mut' }, `${r.aheadA}`)), h('div', { class: 'lab' }, 'Ahead in all shared races'), h('div', { class: 'b' }, nb, h('div', { class: 'mut' }, `${r.aheadB}`))),
      bar(r.aheadA, r.aheadB),
      r.sameTeam ? h('div', { class: 'stat-pair', style: { marginTop: '14px' } },
        h('div', { class: 'a mut' }, `${r.tmA}`), h('div', { class: 'lab' }, `As team-mates (${r.sameTeam} races)`), h('div', { class: 'b mut' }, `${r.tmB}`)) : h('p', { class: 'dim' }, 'They were never team-mates in the selected seasons.'),
      r.sameTeam ? bar(r.tmA, r.tmB) : null);
  }

  F1.pages.drivers = {
    needs: [],
    render() {
      const ps = (F1.ps.drivers = Object.assign({ dtl: 'pts', cmp: null }, F1.ps.drivers));
      const s = F1.state, wrap = h('div');
      const did = s.driver;
      F1.nextHeadline = driverHeadline(did);
      wrap.append(F1.pageHead('Driver Intelligence', did ? F1.dynTitle() : 'Drivers, ' + F1.rangeLabel(s), did ? 'Career view for the selected driver inside the current filters. Add a comparison driver for a side-by-side.' : 'Pick a driver in the toolbar, or click any row below. The table ranks everyone with a start in the selection.'));
      if (!did) {
        const list = F1.leaderboard('driver', s, 'driver');
        if (!list.length) { wrap.append(ui.empty('No drivers in this selection', 'Widen the season range or clear the constructor / circuit filter.')); return wrap; }
        wrap.append(h('div', { class: 'row' }, ui.card({ title: 'All-time leaderboard', note: 'Sortable and searchable. Click a row to open that driver.', src: 'fact_results fact_sprints std_drivers dim_drivers' }, driverTable())));
        return wrap;
      }
      const rows = F1.rows(s), spr = F1.sprintRows(s), a = F1.aggregate(rows, spr), tt = F1.titles(s);
      wrap.append(h('div', { class: 'cmp-bar' }, ui.combo({ label: 'Compare with', placeholder: 'Choose a second driver…', options: F1.options('driver').filter((o) => o.id !== did), value: ps.cmp, onChange: (id) => { ps.cmp = id; F1.go(); } }),
        h('span', { class: 'hint' }, ps.cmp ? 'Profile, timeline and head-to-head now show both drivers.' : 'Optional: adds a second driver to the timeline, profile and head-to-head.')));
      const field = F1.aggregate(F1.rows(s, 'driver'), F1.sprintRows(s, 'driver')), ser0 = F1.seasonSeries(s);
      const sp = ser0.length >= 4 ? { starts: ser0.map((r) => (r.a ? r.a.starts : null)), pts: ser0.map((r) => (r.a ? r.a.totalPts : null)) } : null;
      wrap.append(careerKpis(a, tt.driverNA ? null : tt.drivers.length, field, sp));
      wrap.append(h('div', { class: 'row r-ms' }, driverTimeline(ps, did), profileCard(ps.cmp && ps.cmp !== did ? [did, ps.cmp] : [did])));
      wrap.append(h('div', { class: 'row r2' }, gridFinish(did), ps.cmp && ps.cmp !== did ? h2hCard(did, ps.cmp) : teamHistory(did)));
      if (ps.cmp && ps.cmp !== did) wrap.append(h('div', { class: 'row' }, teamHistory(did)));
      wrap.append(h('div', { class: 'sec-h' }, 'All-time leaderboard'));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Field in the same filters', note: 'Constructor and circuit filters still apply. The selected driver is highlighted.', src: 'fact_results fact_sprints' }, driverTable())));
      return wrap;
    },
  };

  /* ================================================================== CONSTRUCTOR ANALYSIS */
  function consTable() {
    const s = F1.state, list = F1.leaderboard('cons', s, 'cons');
    return ui.table({
      id: 'tbl-cons', cols: [
        { key: 'name', label: 'Constructor', def: 'Constructor IDs are used as stored. Rebrands/ownership changes are separate IDs and are not merged.' }, { key: 'nat', label: 'Nation', cls: 'mut' },
        { key: 'span', label: 'Active', val: (r) => r.y0, fmt: (v, r) => (r.y0 === r.y1 ? r.y0 : `${r.y0}–${r.y1}`) },
        { key: 'races', label: 'GPs', num: true, fmt: fmt.int, def: 'Races entered (at least one car started).' },
        { key: 'starts', label: 'Car starts', num: true, fmt: fmt.int, def: DEF.starts },
        { key: 'wins', label: 'Wins', num: true, bar: true, fmt: fmt.int, def: DEF.wins },
        { key: 'winPct', label: 'Win %', num: true, fmt: fmt.p1, def: DEF.winPct + ' (per car start)', val: (r) => (r.starts >= 20 ? r.winPct : null) },
        { key: 'podiums', label: 'Podiums', num: true, fmt: fmt.int }, { key: 'poles', label: 'Poles', num: true, fmt: fmt.int },
        { key: 'titles', label: 'Titles', num: true, fmt: (v) => (list.titlesNA ? '—' : fmt.int(v)), def: 'Constructors’ Championship titles (1958+), completed seasons, from final constructor standings.' },
        { key: 'totalPts', label: 'Points', num: true, fmt: fmt.pts, def: DEF.pts },
        { key: 'norm', label: 'Era-normalised', num: true, fmt: fmt.p1, def: DEF.norm, val: (r) => (r.starts >= 20 ? r.norm : null) },
        { key: 'dnfRate', label: 'Retired %', num: true, fmt: fmt.p0, def: DEF.dnfRate }, { key: 'mechRate', label: 'Mechanical %', num: true, fmt: fmt.p0, def: DEF.mechRate },
      ],
      rows: list, search: (r) => `${r.name} ${r.nat}`, placeholder: 'Search constructors…', sort: { key: 'wins', dir: 'desc' }, limit: 25,
      isSel: (r) => r.id === s.cons, onRow: (r) => F1.pick({ cons: r.id }), extra: h('span', { class: 'dim' }, 'Rates need ≥20 car starts to rank'),
    });
  }

  function consTrend(ps, cid) {
    const s = F1.state, M = F1.M;
    const opts = [['pts', 'Points'], ['share', 'Season points share'], ['wins', 'Wins'], ['pos', 'Official standing']];
    return F1.chartCard({
      title: 'Season trend', src: 'fact_results std_constructors', def: ps.ctl === 'share' ? 'Points scored by this constructor ÷ all points scored by every constructor that season (era-independent).' : ps.ctl === 'pos' ? 'Final Constructors’ Championship position (1958+; current position for a partial season).' : DEF.pts,
      note: 'Hatched/shaded = partial season. Click a point to filter to that season.',
      actions: ui.seg({ label: 'Trend metric', value: ps.ctl, options: opts.map(([id, label]) => ({ id, label })), onChange: (v) => { ps.ctl = v; F1.go(); } }),
    }, (host, setTitle) => {
      const sr = F1.seasonSeries(Object.assign({}, s, { cons: cid }));
      const data = sr.map((r) => {
        if (!r.a) return [r.year, null];   // a gap in the career stays a gap in the line
        const a = r.a, tot = M.seasonTot.get(r.year), fin = (M.finalC.get(r.year) || []).find((x) => x.k === cid);
        const v = ps.ctl === 'pts' ? a.totalPts : ps.ctl === 'wins' ? a.wins : ps.ctl === 'share' ? (tot.pts ? a.totalPts / tot.pts : null) : fin ? fin.po : null;
        return [r.year, v];
      });
      const partial = F1.partialYearsIn(s)[0];
      const pos = ps.ctl === 'pos';
      const vv = data.filter((p) => p[1] != null), cf = ps.ctl === 'share' ? fmt.p1 : pos ? (v) => 'P' + v : fmt.pts, best = vv.length ? vv.reduce((a, b) => ((pos ? b[1] < a[1] : b[1] > a[1]) ? b : a)) : null;
      const lbl = { pts: 'Points per season', share: 'Share of all points scored that season', wins: 'Wins per season', pos: 'Championship position' }[ps.ctl];
      if (best) setTitle({ pts: `${F1.name.cons(cid)} scored most in ${best[0]} (${cf(best[1])} points)`, share: `${F1.name.cons(cid)}’s share of points peaked at ${cf(best[1])} in ${best[0]}`, wins: `${F1.name.cons(cid)} won most in ${best[0]} (${best[1]})`, pos: `Best championship finish: ${cf(best[1])} in ${best[0]}` }[ps.ctl]);
      charts.line(host, { series: [{ name: F1.name.cons(cid), data, color: ui.C.hi, fmt: cf }], height: 270, yTitle: lbl, xTitle: 'Season', annotate: best ? [{ x: best[0], y: best[1], text: `Best: ${cf(best[1])} (${best[0]})`, below: pos }] : [], y: { fmt: ps.ctl === 'share' ? fmt.p0 : pos ? (v) => 'P' + v : d3.format(','), invert: pos, zero: !pos, domain: pos ? [1, Math.max(6, d3.max(data, (p) => p[1]) || 6)] : undefined }, partial: partial ? { from: partial.year } : null, onClick: (yr) => F1.pick({ y0: yr, y1: yr }), aria: 'Constructor season trend' });
    });
  }

  function consReliability(cid) {
    const s = F1.state;
    return F1.chartCard({ title: 'Reliability by season', src: 'fact_results dim_status', def: 'Stacked share of car starts ending in a mechanical, accident, or other retirement. Rates are of starts; status groups are mapped from statusId.', note: 'Lower bars are better. Partial seasons are hatched.' }, (host, setTitle) => {
      const sr = F1.seasonSeries(Object.assign({}, s, { cons: cid })).filter((r) => r.a);
      if (!sr.length) { host.replaceChildren(ui.empty('No starts in this selection')); return; }
      const done = sr.filter((r) => r.season.complete), n3 = Math.min(3, Math.floor(done.length / 2)), avg = (xs) => d3.sum(xs, (r) => r.a.dnf) / d3.sum(xs, (r) => r.a.starts);
      if (n3 >= 1) { const A = done.slice(0, n3), B = done.slice(-n3), lab = (xs) => (xs[0].year === xs[xs.length - 1].year ? '' + xs[0].year : `${xs[0].year}–${xs[xs.length - 1].year}`); setTitle(ui.changeTitle(`${F1.name.cons(cid)}’s retirement rate`, { x: lab(A), v: avg(A) }, { x: lab(B), v: avg(B) }, fmt.p0)); }
      charts.columns(host, {
        data: sr.map((r) => ({ k: r.year, label: '' + r.year, partial: !r.season.complete, stack: { mech: r.a.mechRate, acc: r.a.accRate, oth: r.a.sg[5] / r.a.starts }, tip: [['Total DNF rate', fmt.p1(r.a.dnfRate)], ['Starts', fmt.int(r.a.starts)]] })),
        stacks: [{ key: 'mech', name: 'Mechanical', color: ui.C.cmp }, { key: 'acc', name: 'Accident', color: ui.C.soft }, { key: 'oth', name: 'Other', color: ui.C.base }], y: { fmt: fmt.p0 }, yTitle: 'Share of car starts ending in a retirement', xTitle: 'Season', height: 250, onClick: (d) => F1.pick({ y0: d.k, y1: d.k }), aria: 'Reliability by season',
      });
    });
  }

  function consDrivers(cid) {
    const s = F1.state, rows = F1.rows(Object.assign({}, s, { cons: cid })), spr = F1.sprintRows(Object.assign({}, s, { cons: cid }));
    const g = F1.groupAgg(rows, (x) => x.d, spr), tot = d3.sum([...g.values()], (a) => a.totalPts);
    const list = [...g].filter(([, a]) => a.starts).map(([d, a]) => Object.assign(a, { d, name: F1.name.driver(d), share: tot ? a.totalPts / tot : null, y0: d3.min([...a.seasons]), y1: d3.max([...a.seasons]) }));
    return ui.card({ title: 'Driver contributions', note: 'Share of the constructor’s recorded points that each driver scored while in the selection. Click to filter to the pairing.', src: 'fact_results fact_sprints' }, ui.table({
      id: 'tbl-contrib', cols: [
        { key: 'name', label: 'Driver' }, { key: 'y0', label: 'Seasons', fmt: (v, r) => (r.y0 === r.y1 ? r.y0 : `${r.y0}–${r.y1}`) }, { key: 'starts', label: 'Starts', num: true, fmt: fmt.int },
        { key: 'wins', label: 'Wins', num: true, fmt: fmt.int }, { key: 'podiums', label: 'Podiums', num: true, fmt: fmt.int },
        { key: 'totalPts', label: 'Points', num: true, bar: true, fmt: fmt.pts }, { key: 'share', label: 'Share', num: true, fmt: fmt.p1, def: 'Driver points ÷ all constructor points in the selection.' },
      ], rows: list, sort: { key: 'totalPts', dir: 'desc' }, maxH: '360px', onRow: (r) => F1.pick({ driver: r.d }), isSel: (r) => r.d === s.driver, search: (r) => r.name, placeholder: 'Search drivers…',
    }));
  }

  function consH2H(a, b) {
    const s = F1.state, M = F1.M;
    const per = (id) => F1.groupAgg(F1.rows(Object.assign({}, s, { cons: id })), (x) => x.y, F1.sprintRows(Object.assign({}, s, { cons: id })));
    const ga = per(a), gb = per(b), years = [...ga.keys()].filter((y) => gb.has(y) && ga.get(y).starts && gb.get(y).starts).sort((p, q) => p - q);
    if (!years.length) return ui.card({ title: 'Head-to-head', src: 'fact_results' }, ui.empty('No shared seasons', `${F1.name.cons(a)} and ${F1.name.cons(b)} never raced in the same season within ${F1.rangeLabel(s)}.`));
    let sa = 0, sb = 0, winA = 0, winB = 0;
    years.forEach((y) => { const A = ga.get(y), B = gb.get(y); if (A.totalPts > B.totalPts) sa++; else if (B.totalPts > A.totalPts) sb++; winA += A.wins; winB += B.wins; });
    return F1.chartCard({ title: 'Head-to-head by season', src: 'fact_results', def: 'Recorded points per season for each constructor in the seasons both raced. “Seasons ahead” compares recorded points (ties ignored).', note: `${years.length} shared seasons · wins ${winA}–${winB}.` }, (host, setTitle) => {
      setTitle(sa === sb ? `${F1.name.cons(a)} and ${F1.name.cons(b)} split ${years.length} shared seasons evenly` : `${F1.name.cons(sa > sb ? a : b)} outscored ${F1.name.cons(sa > sb ? b : a)} in ${Math.max(sa, sb)} of ${years.length} shared seasons`);
      charts.line(host, { series: [{ name: F1.name.cons(a), data: years.map((y) => [y, ga.get(y).totalPts]), color: ui.C.hi }, { name: F1.name.cons(b), data: years.map((y) => [y, gb.get(y).totalPts]), color: ui.C.cmp }], height: 260, endLabels: true, yTitle: 'Points per season', xTitle: 'Season', y: { fmt: d3.format(',') }, partial: F1.partialYearsIn(s)[0] ? { from: F1.partialYearsIn(s)[0].year } : null, aria: 'Constructor head to head' });
    });
  }

  F1.pages.constructors = {
    needs: [],
    render() {
      const ps = (F1.ps.constructors = Object.assign({ ctl: 'pts', cmp: null }, F1.ps.constructors));
      const s = F1.state, cid = s.cons, wrap = h('div');
      F1.nextHeadline = consHeadline(cid);
      wrap.append(F1.pageHead('Constructor Analysis', cid ? F1.dynTitle() : 'Constructors, ' + F1.rangeLabel(s), cid ? 'Constructor view inside the current filters. Constructor IDs are used exactly as stored — rebranded teams are separate entries.' : 'Pick a constructor in the toolbar or click a row. Constructors’ Championship standings exist for 1958 onwards.'));
      if (!cid) {
        const list = F1.leaderboard('cons', s, 'cons');
        if (!list.length) { wrap.append(ui.empty('No constructors in this selection', 'Widen the season range or clear the driver / circuit filter.')); return wrap; }
        wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Constructor leaderboard', note: 'Sortable and searchable. Click a row to open that constructor.', src: 'fact_results fact_sprints std_constructors' }, consTable())));
        return wrap;
      }
      const rows = F1.rows(s), spr = F1.sprintRows(s), a = F1.aggregate(rows, spr), tt = F1.titles(s);
      const cfield = F1.aggregate(F1.rows(s, 'cons'), F1.sprintRows(s, 'cons')), cser = F1.seasonSeries(s), cmult = cfield.winPct && a.starts >= 20 ? a.winPct / cfield.winPct : null;
      wrap.append(h('div', { class: 'cmp-bar' }, ui.combo({ label: 'Compare with', placeholder: 'Choose a second constructor…', options: F1.options('cons').filter((o) => o.id !== cid), value: ps.cmp, onChange: (id) => { ps.cmp = id; F1.go(); } }),
        h('span', { class: 'hint' }, ps.cmp ? 'Head-to-head below compares recorded points season by season.' : 'Optional: adds a season-by-season head-to-head.')));
      wrap.append(h('div', { class: 'kpis' },
        ui.kpi({ label: 'Grands Prix', value: fmt.int(a.races), def: 'Races in which at least one car started.', sub: `${fmt.int(a.starts)} car starts` }),
        ui.kpi({ label: 'Wins', value: fmt.int(a.wins), def: DEF.wins, accent: 'red', delta: cmult == null ? null : { text: `${cmult.toFixed(1)}× the field win rate`, dir: cmult > 1 ? 'up' : cmult < 1 ? 'down' : 'flat', good: cmult > 1, ref: `(${fmt.p1(cfield.winPct)})` }, sub: `${fmt.p1(a.winPct)} per car start` }),
        ui.kpi({ label: 'Podiums', value: fmt.int(a.podiums), def: DEF.podiums }),
        ui.kpi({ label: 'Titles', value: tt.consNA ? '—' : fmt.int(tt.cons.length), def: 'Constructors’ titles from final constructor standings of completed seasons (1958+). Not defined with a circuit or driver filter.', accent: 'gold', sub: tt.consNA ? 'n/a with this filter' : `${tt.drivers.length} drivers’ title${tt.drivers.length === 1 ? '' : 's'} with this car` }),
        ui.kpi({ label: 'Points', value: fmt.pts(a.totalPts), def: DEF.pts, sub: `${fmt.p0(a.norm)} era-normalised · field ${fmt.p0(cfield.norm)}`, spark: cser.length >= 4 ? cser.map((r) => (r.a ? r.a.totalPts : null)) : null }),
        ui.kpi({ label: 'DNF rate', value: fmt.p1(a.dnfRate), def: DEF.dnfRate, delta: a.dnfRate == null || cfield.dnfRate == null ? null : { text: `${a.dnfRate <= cfield.dnfRate ? '−' : '+'}${Math.abs((a.dnfRate - cfield.dnfRate) * 100).toFixed(1)} pts`, dir: a.dnfRate <= cfield.dnfRate ? 'down' : 'up', good: a.dnfRate <= cfield.dnfRate, ref: `vs field ${fmt.p1(cfield.dnfRate)}` }, sub: `mech ${fmt.p1(a.mechRate)} · accident ${fmt.p1(a.accRate)}` })));
      wrap.append(h('div', { class: 'row r2' }, consTrend(ps, cid), consReliability(cid)));
      wrap.append(h('div', { class: 'row r2' }, consDrivers(cid), ps.cmp && ps.cmp !== cid ? consH2H(cid, ps.cmp) : ui.card({ title: 'Head-to-head', note: 'Choose a comparison constructor above to see season-by-season points.' }, ui.empty('No comparison selected'))));
      wrap.append(h('div', { class: 'sec-h' }, 'Constructor leaderboard'));
      wrap.append(h('div', { class: 'row' }, ui.card({ title: 'Field in the same filters', note: 'Driver and circuit filters still apply. The selected constructor is highlighted.', src: 'fact_results fact_sprints' }, consTable())));
      return wrap;
    },
  };
  F1.pages.races = F1.pages.races || { needs: [], render: () => h('div') };
  F1.ps.races = F1.ps.races || {};
})();
