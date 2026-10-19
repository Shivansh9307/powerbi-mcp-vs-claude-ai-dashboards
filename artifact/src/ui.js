/* F1 Evolution - UI primitives and chart kit (d3 only; every visual is drawn from rows passed in). */
(function () {
  'use strict';
  const F1 = (window.F1 = window.F1 || {});
  const ui = (F1.ui = {});
  const charts = (F1.charts = {});

  /* ------------------------------------------------------------------ DOM builder */
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    const put = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(put);
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(put);
    return el;
  };
  ui.h = h;
  const svgNS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  ui.PAL = ['#56B4E9', '#E69F00', '#2FC79A', '#CC79A7', '#F0E442', '#D96A3A', '#8FA1FF', '#B6BDC9'];
  ui.RED = '#E10600'; ui.GOLD = '#C9A44C';
  ui.DASH = ['', '6 3', '2 3', '10 3 2 3', '', '6 3', '2 3', ''];

  /* ------------------------------------------------------------------ tooltip */
  const tip = (ui.tip = {
    el: null,
    show(ev, content) {
      const t = tip.el; if (!t) return;
      t.replaceChildren(...(Array.isArray(content) ? content : [content]).map((c) => (c.nodeType ? c : document.createTextNode(c))));
      t.style.display = 'block';
      const root = t.offsetParent || t.parentElement, r = root.getBoundingClientRect();
      let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 16;
      const w = t.offsetWidth, hh = t.offsetHeight;
      if (x + w > r.width - 6) x = Math.max(6, ev.clientX - r.left - w - 14);
      if (y + hh > r.height - 6) y = Math.max(6, ev.clientY - r.top - hh - 12);
      t.style.left = x + 'px'; t.style.top = y + 'px';
    },
    hide() { if (tip.el) tip.el.style.display = 'none'; },
  });
  /* tooltip body: title line + [label, value, color?] rows */
  ui.tipBody = (title, rows, foot) => {
    const box = h('div', { class: 'tt-body' }, title ? h('div', { class: 'tt-title' }, title) : null);
    (rows || []).forEach((r) => box.append(h('div', { class: 'tt-row' }, r[2] ? h('i', { class: 'tt-sw', style: { background: r[2] } }) : null, h('span', { class: 'tt-k' }, r[0]), h('span', { class: 'tt-v' }, r[1]))));
    if (foot) box.append(h('div', { class: 'tt-foot' }, foot));
    return box;
  };

  /* ------------------------------------------------------------------ small components */
  ui.info = (text) => h('span', { class: 'info', tabindex: '0', role: 'note', 'aria-label': text, 'data-tip': text }, 'i');
  ui.card = (o, ...body) =>
    h('section', { class: 'card ' + (o.cls || ''), id: o.id, 'data-source': o.src },
      h('header', { class: 'card-h' },
        h('div', { class: 'card-t' }, h('h3', null, o.title, o.def ? ui.info(o.def) : null), o.note ? h('p', { class: 'note' }, o.note) : null),
        o.actions ? h('div', { class: 'card-a' }, o.actions) : null),
      h('div', { class: 'card-b' }, body));
  /* sparkline: values per period, null = gap */
  ui.spark = (vals, color) => {
    const v = vals.filter((x) => x != null);
    if (v.length < 3) return null;
    const W = 120, H = 26, mn = Math.min(...v), mx = Math.max(...v), span = mx - mn || 1;
    let d = '', pen = false;
    vals.forEach((x, i) => { if (x == null) { pen = false; return; } d += (pen ? 'L' : 'M') + ((i / (vals.length - 1)) * W).toFixed(1) + ' ' + (H - 3 - ((x - mn) / span) * (H - 6)).toFixed(1); pen = true; });
    const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', width: '100%', height: H, class: 'spark', 'aria-hidden': 'true' });
    svg.append(S('path', { d, fill: 'none', stroke: color || 'var(--bar)', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
    return svg;
  };
  ui.delta = (text, dir, good) => h('span', { class: 'delta ' + (good === true ? 'good' : good === false ? 'bad' : '') }, (dir === 'up' ? '▲ ' : dir === 'down' ? '▼ ' : '● ') + text);
  ui.kpi = (o) =>
    h('div', { class: 'kpi' + (o.accent ? ' accent-' + o.accent : '') },
      h('div', { class: 'kpi-l' }, o.label, o.def ? ui.info(o.def) : null),
      h('div', { class: 'kpi-v' }, o.value),
      o.delta ? h('div', { class: 'kpi-d' }, ui.delta(o.delta.text, o.delta.dir, o.delta.good), h('span', { class: 'dim' }, ' ' + (o.delta.ref || ''))) : null,
      o.sub ? h('div', { class: 'kpi-s' }, o.sub) : null,
      o.spark ? h('div', { class: 'kpi-sp' }, ui.spark(o.spark, o.sparkColor)) : null);
  /* action-title helper: "<what> rose from A in Y0 to B in Y1" - first/last = {x, v} */
  ui.changeTitle = (what, first, last, f) => {
    const rel = first.v ? (last.v - first.v) / Math.abs(first.v) : 0;
    if (Math.abs(rel) < 0.05) return `${what} held steady at about ${f(last.v)} (${first.x}–${last.x})`;
    return `${what} ${rel > 0 ? 'rose' : 'fell'} from ${f(first.v)} in ${first.x} to ${f(last.v)} in ${last.x}`;
  };
  ui.seg = (o) =>
    h('div', { class: 'seg', role: 'group', 'aria-label': o.label },
      o.options.map((op) => h('button', { type: 'button', class: op.id === o.value ? 'on' : '', 'aria-pressed': op.id === o.value ? 'true' : 'false', title: op.title || '', onclick: () => o.onChange(op.id) }, op.label)));
  ui.empty = (msg, sub) => h('div', { class: 'empty' }, h('strong', null, msg), sub ? h('span', null, sub) : null);
  ui.banner = (kind, ...kids) => h('div', { class: 'banner b-' + kind, role: kind === 'warn' ? 'status' : null }, kids);
  ui.pill = (text, cls) => h('span', { class: 'pill ' + (cls || '') }, text);
  ui.skeleton = (n) => h('div', { class: 'skel-wrap' }, Array.from({ length: n || 4 }, () => h('div', { class: 'dash-skeleton skel-line' })));

  /* ------------------------------------------------------------------ combobox (searchable picker) */
  ui.combo = function (o) {
    // o: {options:[{id,name,sub}], value, placeholder, onChange(id|null), label, allLabel}
    const sel = o.options.find((x) => x.id === o.value);
    const input = h('input', { type: 'text', class: 'combo-in', placeholder: o.placeholder, 'aria-label': o.label, autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'false' });
    input.value = sel ? sel.name : '';
    const list = h('ul', { class: 'combo-list', role: 'listbox', hidden: true });
    const clear = h('button', { type: 'button', class: 'combo-x', 'aria-label': 'Clear ' + o.label, hidden: !sel, onclick: (e) => { e.stopPropagation(); o.onChange(null); } }, '×');
    const wrap = h('div', { class: 'combo' + (sel ? ' has' : '') }, h('span', { class: 'combo-l' }, o.label), input, clear, list);
    let active = -1, shown = [];
    const draw = () => {
      const q = F1.norm(input.value === (sel && sel.name) ? '' : input.value);
      shown = o.options.filter((x) => !q || F1.norm(x.name).includes(q) || F1.norm(x.sub).includes(q)).slice(0, 80);
      list.replaceChildren(...shown.map((x, i) => h('li', { role: 'option', class: i === active ? 'act' : '', onmousedown: (e) => { e.preventDefault(); pick(x.id); } }, h('span', null, x.name), h('em', null, x.sub || ''))));
      if (!shown.length) list.replaceChildren(h('li', { class: 'none' }, 'No match in the current season range'));
    };
    const open = () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1; draw(); };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.value = sel ? sel.name : ''; };
    const pick = (id) => { list.hidden = true; o.onChange(id); };
    input.addEventListener('focus', () => { input.select(); open(); });
    input.addEventListener('input', () => { active = 0; list.hidden = false; draw(); });
    input.addEventListener('blur', close);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(shown.length - 1, active + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && shown[Math.max(active, 0)]) { pick(shown[Math.max(active, 0)].id); e.preventDefault(); }
      else if (e.key === 'Escape') { input.blur(); }
    });
    return wrap;
  };

  /* ------------------------------------------------------------------ sortable / searchable table */
  ui.table = function (o) {
    // o: {cols:[{key,label,def,num,fmt(v,row),val(row),w,bar}], rows, search(row)->text, sort:{key,dir}, maxH, onRow(row), isSel(row), limit, empty, id}
    const st = { key: o.sort ? o.sort.key : null, dir: o.sort ? o.sort.dir : 'desc', q: '', limit: o.limit || 120 };
    const cols = o.cols;
    const val = (c, r) => (c.val ? c.val(r) : r[c.key]);
    const barMax = {};
    cols.forEach((c) => { if (c.bar) barMax[c.key] = d3.max(o.rows, (r) => +val(c, r)) || 1; });
    const wrap = h('div', { class: 'tbl' });
    const count = h('span', { class: 'tbl-count' });
    const inp = h('input', { type: 'search', class: 'tbl-q', placeholder: o.placeholder || 'Search…', 'aria-label': 'Search table' });
    const thead = h('thead'), tbody = h('tbody');
    const more = h('button', { type: 'button', class: 'btn ghost', onclick: () => { st.limit += 50; body(); } }, 'Show 50 more rows');
    const sorted = () => {
      let rows = o.rows;
      if (st.q) { const q = F1.norm(st.q); rows = rows.filter((r) => F1.norm(o.search ? o.search(r) : '').includes(q)); }
      const c = cols.find((x) => x.key === st.key);
      if (c) {
        const dir = st.dir === 'asc' ? 1 : -1;
        rows = rows.slice().sort((a, b) => {
          const va = val(c, a), vb = val(c, b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1; if (vb == null) return -1;   // missing values always last
          return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
        });
      }
      return rows;
    };
    const head = () => {
      thead.replaceChildren(h('tr', null, cols.map((c) => {
        const on = c.key === st.key;
        return h('th', { class: (c.num ? 'num ' : '') + (c.cls || ''), 'aria-sort': on ? (st.dir === 'asc' ? 'ascending' : 'descending') : 'none', style: c.w ? { width: c.w } : null },
          h('button', { type: 'button', class: 'th-b' + (on ? ' on' : ''), onclick: () => { if (st.key === c.key) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.key = c.key; st.dir = c.num ? 'desc' : 'asc'; } head(); body(); } },
            c.label, on ? h('span', { class: 'arr' }, st.dir === 'asc' ? '▲' : '▼') : null),
          c.def ? ui.info(c.def) : null);
      })));
    };
    const body = () => {
      const rows = sorted();
      count.textContent = (st.q ? rows.length + ' of ' : '') + fmtInt(o.rows.length) + ' rows';
      if (!rows.length) { tbody.replaceChildren(h('tr', null, h('td', { colspan: cols.length, class: 'empty-td' }, o.empty || (st.q ? 'No rows match “' + st.q + '”.' : 'No rows for the current selection.')))); more.hidden = true; return; }
      tbody.replaceChildren(...rows.slice(0, st.limit).map((r) => {
        const tr = h('tr', { class: (o.onRow ? 'click ' : '') + (o.isSel && o.isSel(r) ? 'sel' : ''), tabindex: o.onRow ? '0' : null, onclick: o.onRow ? () => o.onRow(r) : null, onkeydown: o.onRow ? (e) => { if (e.key === 'Enter') o.onRow(r); } : null });
        cols.forEach((c) => {
          const v = val(c, r), txt = c.fmt ? c.fmt(v, r) : v == null ? '—' : v;
          const td = h('td', { class: (c.num ? 'num ' : '') + (c.cls || '') + (v == null ? ' na' : '') });
          if (c.bar && v != null) td.append(h('span', { class: 'cbar', style: { width: Math.max(1, (100 * +v) / barMax[c.key]) + '%' } }));
          td.append(h('span', { class: 'cv' }, txt));
          tr.append(td);
        });
        return tr;
      }));
      more.hidden = rows.length <= st.limit;
    };
    const csv = () => {
      const esc = (v) => { if (v == null) return ''; const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      const text = [cols.map((c) => esc(c.label)).join(','), ...sorted().map((r) => cols.map((c) => esc(val(c, r))).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = (o.id || 'table') + '.csv';
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    inp.addEventListener('input', () => { st.q = inp.value.trim(); st.limit = o.limit || 120; body(); });
    head(); body();
    wrap.append(h('div', { class: 'tbl-bar' }, o.search ? inp : null, count, o.extra || null, h('button', { type: 'button', class: 'btn ghost csv', 'aria-label': 'Download the rows currently shown as CSV', onclick: csv }, 'Export CSV')),
      h('div', { class: 'tbl-scroll', style: o.maxH && o.rows.length <= st.limit ? { maxHeight: o.maxH } : null }, h('table', { class: 'data', id: o.id }, thead, tbody)), more);
    return wrap;
  };
  const fmtInt = (v) => F1.fmt.int(v);

  /* ------------------------------------------------------------------ chart plumbing */
  /* colour ROLES (grey base + one highlight): base = context, hi = the thing to look at, cmp = the second entity / a loss, red = selection */
  ui.C = { base: '#5f6b7e', hi: '#56B4E9', cmp: '#E69F00', soft: '#8a94a4', red: '#E10600' };
  ui.SERIES = [ui.C.hi, ui.C.cmp, ui.C.soft, ui.C.base];
  const FS = 12;                                        // minimum chart text size
  const width = (host) => Math.max(280, Math.floor(host.clientWidth || host.parentElement && host.parentElement.clientWidth || 640));
  const mkSvg = (host, w, hgt) => {
    host.replaceChildren();
    const svg = S('svg', { viewBox: `0 0 ${w} ${hgt}`, width: '100%', height: hgt, role: 'img', class: 'chart' });
    host.append(svg); return svg;
  };
  const styleAxis = (g) => {
    g.select('.domain').attr('stroke', 'var(--axis)');
    g.selectAll('.tick line').attr('stroke', 'var(--grid)');
    g.selectAll('.tick text').attr('fill', 'var(--mut)').attr('font-size', FS).attr('font-family', null);
    g.attr('font-size', null).attr('font-family', null);
  };
  const measure = (svg, texts, size) => {
    const t = S('text', { 'font-size': size || FS, visibility: 'hidden' }); svg.append(t);
    let m = 0; texts.forEach((s) => { t.textContent = s; m = Math.max(m, t.getComputedTextLength()); }); t.remove(); return m;
  };
  ui.measure = measure;
  ui.ariaLabel = (svg, txt) => svg.setAttribute('aria-label', txt);
  /* axis titles: y title horizontal at the top-left (read before the data), x title left-aligned under the axis */
  const axisTitles = (g, o, m, hgt) => {
    if (o.yTitle) g.append('text').attr('x', 2).attr('y', 12).attr('fill', 'var(--mut)').attr('font-size', FS).attr('font-weight', 600).text(o.yTitle);
    if (o.xTitle) g.append('text').attr('x', m.l).attr('y', hgt - 3).attr('fill', 'var(--mut)').attr('font-size', FS).text(o.xTitle);
  };
  /* annotation: label (+ leader) placed beside a point; keeps text inside the plot and nudges collisions */
  const placeNotes = (g, svg, notes, bounds) => {
    const placed = [];
    notes.filter((n) => n && n.text).sort((a, b) => a.px - b.px).forEach((n) => {
      const tw = measure(svg, [n.text], FS);
      let dy = n.below ? 20 : -14, anchor = 'middle', tx = n.px, side = false;
      if (tx - tw / 2 < bounds.l) { anchor = 'start'; tx = n.px + 9; side = true; } else if (tx + tw / 2 > bounds.r) { anchor = 'end'; tx = n.px - 9; side = true; }
      let ty = side ? n.py + 4 : n.py + dy;
      placed.forEach((p) => { if (Math.abs(p.tx - tx) < (p.tw + tw) / 2 + 6 && Math.abs(p.ty - ty) < 15) ty = n.below ? p.ty + 15 : p.ty - 15; });
      ty = Math.max(bounds.t + 11, Math.min(bounds.b - 3, ty));
      placed.push({ tx, ty, tw });
      if (!side) g.append('line').attr('x1', n.px).attr('x2', n.px).attr('y1', n.py + (n.below ? 5 : -5)).attr('y2', ty + (n.below ? -11 : 3)).attr('stroke', 'var(--fg)').attr('stroke-opacity', 0.45).attr('pointer-events', 'none');
      g.append('text').attr('x', tx).attr('y', ty).attr('text-anchor', anchor).attr('fill', 'var(--fg)').attr('font-size', FS).attr('font-weight', 600).attr('pointer-events', 'none').attr('stroke', 'var(--panel)').attr('stroke-width', 4).attr('stroke-linejoin', 'round').attr('paint-order', 'stroke').text(n.text);
    });
  };
  /* data-derived annotations for a numeric series [[x,y],...]: peak, trough, last point */
  ui.autoNotes = (pts, f, o) => {
    o = o || {};
    const v = pts.filter((p) => p[1] != null);
    if (v.length < 3) return [];
    const out = [], hi = v.reduce((a, b) => (b[1] > a[1] ? b : a)), lo = v.reduce((a, b) => (b[1] < a[1] ? b : a)), last = v[v.length - 1];
    const lastLabel = o.lastLabel || ((p) => `${p[0]}: ${f(p[1])}`);
    if (o.peak !== false && hi !== last) out.push({ x: hi[0], y: hi[1], text: (o.peakLabel || ((p) => `Peak ${f(p[1])} (${p[0]})`))(hi) });
    if (o.trough) out.push({ x: lo[0], y: lo[1], text: `Low ${f(lo[1])} (${lo[0]})`, below: true });
    if (o.last !== false) out.push({ x: last[0], y: last[1], text: lastLabel(last) });
    return out;
  };

  /* ------------------------------------------------------------------ line chart */
  charts.line = function (host, o) {
    const w = width(host), hgt = o.height || 260;
    const svg = mkSvg(host, w, hgt);
    const all = o.series.flatMap((s) => s.data.filter((p) => p[1] != null));
    if (!all.length) { host.replaceChildren(ui.empty('No data for this selection')); return; }
    const yfmt = (o.y && o.y.fmt) || d3.format(',');
    const xs = all.map((p) => p[0]);
    const xd = (o.x && o.x.domain) || [d3.min(xs), d3.max(xs)];
    let yd = (o.y && o.y.domain) || [o.y && o.y.zero === false ? d3.min(all, (p) => p[1]) : Math.min(0, d3.min(all, (p) => p[1])), d3.max(all, (p) => p[1])];
    if (yd[0] === yd[1]) yd = [yd[0] - 1, yd[1] + 1];
    const yTickW = measure(svg, [yfmt(yd[0]), yfmt(yd[1])]);
    const endW = o.endLabels ? Math.min(130, measure(svg, o.series.map((s) => s.name.slice(0, 20)))) + 8 : 0;
    const m = { t: o.yTitle ? 26 : 14, r: 12 + endW, b: o.xTitle ? 44 : 28, l: Math.ceil(yTickW) + 14 };
    const x = d3.scaleLinear(xd[0] === xd[1] ? [xd[0] - 1, xd[1] + 1] : xd, [m.l, w - m.r]);
    const y = d3.scaleLinear(yd, o.y && o.y.invert ? [m.t, hgt - m.b] : [hgt - m.b, m.t]);
    if (!(o.y && o.y.domain)) y.nice();
    const g = d3.select(svg);
    g.append('g').attr('transform', `translate(0,${hgt - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(w / 80))).tickFormat((o.x && o.x.fmt) || d3.format('d')).tickSizeOuter(0)).call(styleAxis);
    g.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yfmt).tickSize(-(w - m.l - m.r)).tickSizeOuter(0)).call(styleAxis).call((a) => a.select('.domain').remove());
    axisTitles(g, o, m, hgt);
    if (o.partial) {
      const x0 = x(o.partial.from - 0.5);
      g.append('rect').attr('x', x0).attr('y', m.t).attr('width', Math.max(0, w - m.r - x0)).attr('height', hgt - m.t - m.b).attr('fill', 'var(--partial)');
      g.append('text').attr('x', w - m.r - 3).attr('y', hgt - m.b - 5).attr('text-anchor', 'end').attr('fill', 'var(--mut)').attr('font-size', FS).text('partial season');
    }
    (o.ref || []).forEach((r) => {
      g.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(r.y)).attr('y2', y(r.y)).attr('stroke', 'var(--mut)').attr('stroke-dasharray', '4 4').attr('opacity', 0.7);
      g.append('text').attr('x', w - m.r - 2).attr('y', y(r.y) - 4).attr('text-anchor', 'end').attr('fill', 'var(--mut)').attr('font-size', FS).text(r.label);
    });
    const line = d3.line().defined((p) => p[1] != null).x((p) => x(p[0])).y((p) => y(p[1])).curve(d3.curveLinear);
    const ends = [];
    o.series.forEach((s, i) => {
      const col = s.color || ui.SERIES[i % ui.SERIES.length], n = s.data.filter((p) => p[1] != null).length;
      g.append('path').attr('d', line(s.data)).attr('fill', 'none').attr('stroke', col).attr('stroke-width', s.w || (i === 0 ? 2.5 : 1.75)).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('stroke-dasharray', s.dash == null ? ui.DASH[i % ui.DASH.length] : s.dash);
      if (n <= 12) s.data.forEach((p) => { if (p[1] != null) g.append('circle').attr('cx', x(p[0])).attr('cy', y(p[1])).attr('r', 2.8).attr('fill', col); });
      if (o.endLabels) {
        const last = [...s.data].reverse().find((p) => p[1] != null);
        if (last) ends.push({ col, name: s.name, x: x(last[0]) + 6, y: y(last[1]) + 4 });
      }
    });
    ends.sort((p, q) => p.y - q.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    ends.forEach((e) => g.append('text').attr('x', e.x).attr('y', e.y).attr('fill', e.col).attr('font-size', FS).attr('font-weight', 600).text(e.name.length > 20 ? e.name.slice(0, 19) + '…' : e.name));
    /* annotations on the first series (or on a named one) */
    const notes = (o.annotate || []).map((a) => ({ px: x(a.x), py: y(a.y), text: a.text, below: a.below }));
    notes.forEach((n) => g.append('circle').attr('cx', n.px).attr('cy', n.py).attr('r', 4.5).attr('fill', 'var(--panel)').attr('stroke', 'var(--fg)').attr('stroke-width', 2).attr('pointer-events', 'none'));
    placeNotes(g, svg, notes, { l: m.l, r: w - m.r, t: m.t, b: hgt - m.b });
    /* hover */
    const rule = g.append('line').attr('y1', m.t).attr('y2', hgt - m.b).attr('stroke', 'var(--mut)').attr('opacity', 0).attr('pointer-events', 'none');
    const dots = g.append('g').attr('pointer-events', 'none');
    const xvals = [...new Set(xs)].sort((a, b) => a - b);
    const bis = d3.bisector((v) => v).center;
    let kbIdx = null;
    const showAt = (xv, ev) => {
      rule.attr('x1', x(xv)).attr('x2', x(xv)).attr('opacity', 0.6);
      dots.selectAll('*').remove();
      const rows = [];
      o.series.forEach((s, i) => {
        const p = s.data.find((q) => q[0] === xv); if (!p || p[1] == null) return;
        const col = s.color || ui.SERIES[i % ui.SERIES.length];
        dots.append('circle').attr('cx', x(xv)).attr('cy', y(p[1])).attr('r', 4.5).attr('fill', col).attr('stroke', 'var(--panel)').attr('stroke-width', 1.5);
        rows.push([s.name, (s.fmt || yfmt)(p[1]), col]);
      });
      tip.show(ev, ui.tipBody(((o.x && o.x.fmt) || d3.format('d'))(xv) + (o.partial && xv >= o.partial.from ? ' (partial)' : ''), rows, o.onClick ? 'Click to drill down' : null));
    };
    g.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', hgt - m.t - m.b).attr('fill', 'transparent').style('cursor', o.onClick ? 'pointer' : 'default')
      .attr('tabindex', 0).attr('role', 'img').attr('aria-label', (o.aria || 'Line chart') + '. Use the left and right arrow keys to read values, Enter to drill down.')
      .on('keydown', (ev) => {
        if (!['ArrowLeft', 'ArrowRight', 'Enter'].includes(ev.key)) return;
        ev.preventDefault();
        if (ev.key === 'Enter') { if (o.onClick && kbIdx != null) o.onClick(xvals[kbIdx]); return; }
        kbIdx = Math.max(0, Math.min(xvals.length - 1, (kbIdx == null ? xvals.length : kbIdx) + (ev.key === 'ArrowRight' ? 1 : -1)));
        const r = svg.getBoundingClientRect();
        showAt(xvals[kbIdx], { clientX: r.left + (x(xvals[kbIdx]) / w) * r.width, clientY: r.top + m.t + 24 });
      })
      .on('blur', () => { kbIdx = null; rule.attr('opacity', 0); dots.selectAll('*').remove(); tip.hide(); })
      .on('mousemove', (ev) => {
        const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * w;
        showAt(xvals[bis(xvals, x.invert(px))], ev);
      })
      .on('mouseleave', () => { rule.attr('opacity', 0); dots.selectAll('*').remove(); tip.hide(); })
      .on('click', (ev) => { if (!o.onClick) return; const r = svg.getBoundingClientRect(); o.onClick(xvals[bis(xvals, x.invert(((ev.clientX - r.left) / r.width) * w))]); });
    svg.setAttribute('aria-label', o.aria || 'Line chart');
  };

  /* ------------------------------------------------------------------ column chart (single or stacked) */
  charts.columns = function (host, o) {
    // o: {data:[{k,label,v,stack:{key:v},partial,tip,color}], stacks:[{key,name,color}], y:{fmt,domain}, yTitle, xTitle, highlight(d), annotate:[{k,text}], onClick(d), selected(k), tickEvery, height, ref}
    const w = width(host), hgt = o.height || 240;
    const svg = mkSvg(host, w, hgt);
    const data = o.data;
    if (!data.length) { host.replaceChildren(ui.empty('No data for this selection')); return; }
    const yfmt = (o.y && o.y.fmt) || d3.format(',');
    const tot = (d) => (o.stacks ? d3.sum(o.stacks, (s) => d.stack[s.key] || 0) : d.v);
    const maxV = (o.y && o.y.domain && o.y.domain[1]) || d3.max(data, (d) => tot(d)) || 1;
    const minV = o.y && o.y.domain ? o.y.domain[0] : Math.min(0, d3.min(data, (d) => (o.stacks ? 0 : d.v)) || 0);
    const yTickW = measure(svg, [yfmt(maxV), yfmt(minV)]);
    const direct = o.stacks && o.stacks.length <= 4 && o.directLabels !== false;
    const dlW = direct ? Math.min(140, measure(svg, o.stacks.map((s) => s.name))) + 10 : 0;
    const m = { t: o.yTitle ? 30 : 18, r: 8 + dlW, b: o.xTitle ? 44 : 28, l: Math.ceil(yTickW) + 14 };
    const x = d3.scaleBand(data.map((d) => d.k), [m.l, w - m.r]).paddingInner(0.18).paddingOuter(0.05);
    const y = d3.scaleLinear([minV, maxV], [hgt - m.b, m.t]);
    if (!(o.y && o.y.domain)) y.nice();
    const g = d3.select(svg);
    const every = o.tickEvery || Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor((w - m.l) / 46))));
    g.append('g').attr('transform', `translate(0,${hgt - m.b})`).call(d3.axisBottom(x).tickValues(data.filter((_, i) => i % every === 0).map((d) => d.k)).tickFormat((k) => (data.find((d) => d.k === k) || {}).label ?? k).tickSizeOuter(0)).call(styleAxis);
    g.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yfmt).tickSize(-(w - m.l - m.r)).tickSizeOuter(0)).call(styleAxis).call((a) => a.select('.domain').remove());
    axisTitles(g, o, m, hgt);
    const defs = g.append('defs');
    const patId = 'hatch' + Math.random().toString(36).slice(2, 7);
    defs.append('pattern').attr('id', patId).attr('width', 5).attr('height', 5).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)').append('rect').attr('width', 2).attr('height', 5).attr('fill', 'var(--fg)').attr('opacity', 0.55);
    (o.ref || []).forEach((r) => {
      g.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(r.y)).attr('y2', y(r.y)).attr('stroke', 'var(--mut)').attr('stroke-dasharray', '4 4');
      g.append('text').attr('x', w - m.r - 2).attr('y', y(r.y) - 4).attr('text-anchor', 'end').attr('fill', 'var(--mut)').attr('font-size', FS).text(r.label);
    });
    const bw = x.bandwidth(), rx = Math.min(3, bw / 3);
    const noted = new Map((o.annotate || []).map((a) => [a.k, a]));
    const barColor = (d) => d.color || (o.highlight || noted.size ? ((o.highlight && o.highlight(d)) || noted.has(d.k) ? ui.C.hi : ui.C.base) : o.color || ui.C.hi);
    data.forEach((d) => {
      const sel = o.selected && o.selected(d.k);
      const grp = g.append('g').style('cursor', o.onClick ? 'pointer' : 'default');
      const segs = o.stacks ? o.stacks.map((s) => ({ s, v: d.stack[s.key] || 0 })) : [{ s: { color: barColor(d) }, v: d.v }];
      let acc = 0;
      segs.forEach((sg) => {
        if (sg.v == null || (sg.v === 0 && o.stacks)) return;
        const y0 = o.stacks ? y(acc + sg.v) : y(Math.max(sg.v, 0)), y1 = o.stacks ? y(acc) : y(Math.min(sg.v, 0) || 0);
        grp.append('rect').attr('x', x(d.k)).attr('y', y0).attr('width', bw).attr('height', Math.max(0.5, y1 - y0)).attr('rx', o.stacks ? 0 : rx).attr('fill', sg.s.color).attr('opacity', sel === false ? 0.45 : 1);
        if (d.partial) grp.append('rect').attr('x', x(d.k)).attr('y', y0).attr('width', bw).attr('height', Math.max(0.5, y1 - y0)).attr('fill', `url(#${patId})`);
        acc += sg.v;
      });
      if (sel) grp.append('rect').attr('x', x(d.k) - 1).attr('y', m.t).attr('width', bw + 2).attr('height', hgt - m.t - m.b).attr('fill', 'none').attr('stroke', ui.C.red).attr('stroke-width', 1.5);
      const tipFor = () => {
        const rows = o.stacks ? o.stacks.map((s) => [s.name, yfmt(d.stack[s.key] || 0), s.color]).reverse() : [[o.name || 'Value', (o.valFmt || yfmt)(d.v)]];
        return ui.tipBody(d.label + (d.partial ? ' (partial season)' : ''), rows.concat(d.tip || []), o.onClick ? 'Click to drill down' : null);
      };
      const valueText = o.stacks ? o.stacks.map((s) => `${s.name} ${yfmt(d.stack[s.key] || 0)}`).join(', ') : (o.valFmt || yfmt)(d.v);
      grp.append('rect').attr('x', x(d.k) - 1).attr('y', m.t).attr('width', bw + 2).attr('height', hgt - m.t - m.b).attr('fill', 'transparent')
        .attr('tabindex', 0).attr('role', o.onClick ? 'button' : 'img').attr('aria-label', `${d.label}${d.partial ? ' (partial season)' : ''}: ${valueText}`)
        .on('mousemove', (ev) => tip.show(ev, tipFor()))
        .on('focus', function () { const b = this.getBoundingClientRect(); tip.show({ clientX: b.left + b.width / 2, clientY: b.top + 24 }, tipFor()); })
        .on('blur', () => tip.hide())
        .on('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && o.onClick) { ev.preventDefault(); o.onClick(d); } })
        .on('mouseleave', () => tip.hide())
        .on('click', () => o.onClick && o.onClick(d));
    });
    /* annotations sit above the annotated bar */
    placeNotes(g, svg, (o.annotate || []).map((a) => { const d = data.find((q) => q.k === a.k); return d ? { px: x(d.k) + bw / 2, py: y(Math.max(tot(d), 0)), text: a.text } : null; }), { l: m.l, r: w - m.r, t: m.t - 14, b: hgt - m.b });
    /* direct labels for stacked segments (replaces a legend) */
    if (direct) {
      const last = data[data.length - 1], lab = [];
      let acc = 0;
      o.stacks.forEach((s) => { const v = last.stack[s.key] || 0; lab.push({ y: y(acc + v / 2) + 4, col: s.color, name: s.name }); acc += v; });
      lab.sort((a, b) => a.y - b.y);
      for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 14) lab[i].y = lab[i - 1].y + 14;
      lab.forEach((l) => g.append('text').attr('x', w - m.r + 6).attr('y', l.y).attr('fill', l.col).attr('font-size', FS).attr('font-weight', 600).text(l.name));
    }
    svg.setAttribute('aria-label', o.aria || 'Column chart');
  };

  /* ------------------------------------------------------------------ ranked horizontal bars (HTML) */
  charts.hbars = function (host, o) {
    // o: {items:[{id,label,sub,value,text,color,selected,tip}], onClick(item), max}
    host.replaceChildren();
    if (!o.items.length) { host.append(ui.empty('No data for this selection')); return; }
    const max = o.max || d3.max(o.items, (i) => i.value) || 1;
    host.append(h('div', { class: 'hb' }, o.items.map((it, i) =>
      h(o.onClick ? 'button' : 'div', {
        type: o.onClick ? 'button' : null, class: 'hb-row' + (it.selected ? ' sel' : ''), 'aria-label': `${it.label}: ${it.text}`,
        onclick: o.onClick ? () => o.onClick(it) : null,
        onmousemove: it.tip ? (e) => tip.show(e, it.tip) : null, onmouseleave: it.tip ? () => tip.hide() : null,
      },
      h('span', { class: 'hb-rank' }, i + 1),
      h('span', { class: 'hb-name' }, it.label, it.sub ? h('em', null, it.sub) : null),
      h('span', { class: 'hb-track' }, h('span', { class: 'hb-fill', style: { width: Math.max(0.5, (100 * Math.max(it.value, 0)) / max) + '%', background: it.color || (it.selected ? 'var(--red)' : it.hi ? 'var(--hi)' : 'var(--base)') } })),
      h('span', { class: 'hb-val' }, it.text)))));
  };

  /* ------------------------------------------------------------------ heatmap (grid cells) */
  charts.heat = function (host, o) {
    // o: {xs:[label], ys:[label], cells:[{xi,yi,v,tip}], color(v), xLabel, yLabel, height, text(v), onClick(cell), legend}
    const w = width(host);
    const yw = Math.ceil(measure(mkSvg(host, w, 10), o.ys.map(String))) + 22;
    const m = { t: o.yLabel ? 26 : 8, r: 6, b: 38 + (o.legend ? 22 : 0), l: yw };
    const cw = Math.max(6, (w - m.l - m.r) / o.xs.length);
    const ch = Math.min(o.cellH || 22, Math.max(10, ((o.height || 320) - m.t - m.b) / o.ys.length));
    const hgt = m.t + m.b + ch * o.ys.length;
    const svg = mkSvg(host, w, hgt), g = d3.select(svg);
    const every = Math.max(1, Math.ceil(o.xs.length / Math.floor((w - m.l) / 30)));
    o.xs.forEach((l, i) => { if (i % every === 0) g.append('text').attr('x', m.l + i * cw + cw / 2).attr('y', hgt - m.b + 14).attr('text-anchor', 'middle').attr('fill', 'var(--mut)').attr('font-size', 12).text(l); });
    o.ys.forEach((l, i) => g.append('text').attr('x', m.l - 6).attr('y', m.t + i * ch + ch / 2 + 4).attr('text-anchor', 'end').attr('fill', 'var(--mut)').attr('font-size', 12).text(l));
    if (o.xLabel) g.append('text').attr('x', m.l).attr('y', hgt - m.b + 32).attr('fill', 'var(--mut)').attr('font-size', 12).text(o.xLabel);
    if (o.yLabel) g.append('text').attr('x', 2).attr('y', 14).attr('fill', 'var(--mut)').attr('font-size', 12).attr('font-weight', 600).text(o.yLabel);
    if (o.legend) {
      const gid = 'hl' + Math.random().toString(36).slice(2, 7), gr = g.append('defs').append('linearGradient').attr('id', gid);
      for (let i = 0; i <= 8; i++) gr.append('stop').attr('offset', i / 8).attr('stop-color', o.color((i / 8) * (o.legend.max || 1)));
      g.append('text').attr('x', m.l).attr('y', hgt - 6).attr('fill', 'var(--mut)').attr('font-size', 12).text(o.legend.lo || 'Fewer');
      const lx = m.l + measure(svg, [o.legend.lo || 'Fewer']) + 8;
      g.append('rect').attr('x', lx).attr('y', hgt - 15).attr('width', 90).attr('height', 9).attr('rx', 2).attr('fill', `url(#${gid})`);
      g.append('text').attr('x', lx + 98).attr('y', hgt - 6).attr('fill', 'var(--mut)').attr('font-size', 12).text(o.legend.hi || 'More');
    }
    o.cells.forEach((c) => {
      const r = g.append('rect').attr('x', m.l + c.xi * cw + 0.5).attr('y', m.t + c.yi * ch + 0.5).attr('width', cw - 1).attr('height', ch - 1).attr('rx', 2).attr('fill', c.v == null ? 'var(--nodata)' : o.color(c.v)).style('cursor', o.onClick ? 'pointer' : 'default')
        .on('mousemove', (ev) => c.tip && tip.show(ev, c.tip)).on('mouseleave', () => tip.hide()).on('click', () => o.onClick && o.onClick(c));
      if (o.text && c.v != null && cw > 24 && ch > 15) g.append('text').attr('x', m.l + c.xi * cw + cw / 2).attr('y', m.t + c.yi * ch + ch / 2 + 4).attr('text-anchor', 'middle').attr('fill', o.textColor ? o.textColor(c.v) : 'var(--fg)').attr('font-size', 11).attr('pointer-events', 'none').text(o.text(c.v));
    });
    svg.setAttribute('aria-label', o.aria || 'Heatmap');
  };

  /* ------------------------------------------------------------------ scatter */
  charts.scatter = function (host, o) {
    // o: {points:[{x,y,label,color,tip,r}], xd, yd, invertY, diag, xLabel, yLabel, height, onClick, showLabels}
    const w = width(host), hgt = o.height || 320;
    const svg = mkSvg(host, w, hgt), g = d3.select(svg);
    if (!o.points.length) { host.replaceChildren(ui.empty('No data for this selection')); return; }
    const m = { t: o.yLabel ? 28 : 10, r: 14, b: 44, l: 46 };
    const xd = o.xd || [0, d3.max(o.points, (p) => p.x)], yd = o.yd || [0, d3.max(o.points, (p) => p.y)];
    const x = d3.scaleLinear(xd, [m.l, w - m.r]), y = d3.scaleLinear(yd, o.invertY ? [m.t, hgt - m.b] : [hgt - m.b, m.t]);
    g.append('g').attr('transform', `translate(0,${hgt - m.b})`).call(d3.axisBottom(x).ticks(8).tickFormat(o.xFmt || d3.format('d')).tickSize(-(hgt - m.t - m.b)).tickSizeOuter(0)).call(styleAxis);
    g.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(8).tickFormat(o.yFmt || d3.format('d')).tickSize(-(w - m.l - m.r)).tickSizeOuter(0)).call(styleAxis).call((a) => a.select('.domain').remove());
    if (o.diag) g.append('line').attr('x1', x(Math.max(xd[0], yd[0]))).attr('y1', y(Math.max(xd[0], yd[0]))).attr('x2', x(Math.min(xd[1], yd[1]))).attr('y2', y(Math.min(xd[1], yd[1]))).attr('stroke', 'var(--mut)').attr('stroke-dasharray', '5 4');
    if (o.xLabel) g.append('text').attr('x', m.l).attr('y', hgt - 4).attr('fill', 'var(--mut)').attr('font-size', 12).text(o.xLabel);
    if (o.yLabel) g.append('text').attr('x', 2).attr('y', 14).attr('fill', 'var(--mut)').attr('font-size', 12).attr('font-weight', 600).text(o.yLabel);
    o.points.forEach((p) => {
      g.append('circle').attr('cx', x(p.x)).attr('cy', y(p.y)).attr('r', p.r || 4.5).attr('fill', p.color || ui.C.hi).attr('fill-opacity', 0.9).attr('stroke', 'var(--panel)').style('cursor', o.onClick ? 'pointer' : 'default')
        .on('mousemove', (ev) => p.tip && tip.show(ev, p.tip)).on('mouseleave', () => tip.hide()).on('click', () => o.onClick && o.onClick(p));
      if (o.showLabels && p.label) g.append('text').attr('x', x(p.x) + 7).attr('y', y(p.y) + 3).attr('fill', 'var(--mut)').attr('font-size', 11).attr('pointer-events', 'none').text(p.label);
    });
    svg.setAttribute('aria-label', o.aria || 'Scatter plot');
  };

  /* ------------------------------------------------------------------ legend chips */
  ui.legend = (items) => h('div', { class: 'legend' }, items.map((i) => h('span', { class: 'lg' }, h('i', { style: { background: i.color } }), i.name)));
  /* colour ramp for heat cells: dark -> blue */
  ui.ramp = (max) => { const s = d3.scaleSequential([0, 1], d3.interpolateRgb('#1c2633', '#56B4E9')); return (v) => s(Math.sqrt(Math.min(Math.max(v, 0), max || 1) / (max || 1))); };
  ui.rampRed = (max) => { const s = d3.scaleSequential([0, max || 1], d3.interpolateRgb('#2a1a1c', '#ff5a4d')); return (v) => s(Math.min(v, max || 1)); };
})();
