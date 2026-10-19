// Test harness (no browser needed): loads the dashboard scripts against a fake DOM + minimal d3 and runs every page's data code.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src'), DATA = path.join(__dirname, '..', 'data');

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const tables = {};
const DS = { dim_drivers: 1, dim_constructors: 1, dim_circuits: 1, dim_status: 1, fact_races: 1, fact_results: 1, fact_sprints: 1, fact_quali: 1, fact_pits: 1, fact_laps: 1, std_drivers: 1, std_constructors: 1, dq_tables: 1, dq_nulls: 1, dq_fk: 1, dq_coverage: 1, dq_text: 1 };
Object.keys(DS).forEach((k) => (tables[k] = parseCSV(fs.readFileSync(path.join(DATA, k + '.csv'), 'utf8'))));

/* ---- minimal d3 ---- */
const d3 = {};
d3.format = (spec) => { const m = /^(,)?(?:\.(\d+))?(~)?([fd%]?)$/.exec(spec) || []; return (v) => { let s = v; if (m[4] === '%') s = (v * 100).toFixed(+m[2] || 0) + '%'; else if (m[4] === 'f') s = (+v).toFixed(+m[2]); else s = String(Math.round(v)); if (m[3]) s = s.replace(/\.?0+$/, ''); return s; }; };
d3.sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
d3.max = (a, f) => { let m; for (const x of a) { const v = f ? f(x) : x; if (v != null && !(v < m)) m = v; } return m; };
d3.min = (a, f) => { let m; for (const x of a) { const v = f ? f(x) : x; if (v != null && !(v > m)) m = v; } return m; };
d3.mean = (a, f) => { const v = a.map((x) => (f ? f(x) : x)).filter((x) => x != null); return v.length ? d3.sum(v) / v.length : undefined; };
d3.median = (a, f) => { const v = a.map((x) => (f ? f(x) : x)).filter((x) => x != null).sort((p, q) => p - q); if (!v.length) return undefined; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
d3.quantileSorted = (v, p) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))];
d3.range = (a, b) => { if (b === undefined) { b = a; a = 0; } const o = []; for (let i = a; i < b; i++) o.push(i); return o; };
d3.group = (a, ...ks) => { const m = new Map(); a.forEach((x) => { const k = ks[0](x); (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; };
d3.rollup = (a, red, k) => { const g = d3.group(a, k), o = new Map(); g.forEach((v, key) => o.set(key, red(v))); return o; };
d3.rollups = (a, red, k) => [...d3.rollup(a, red, k)];
d3.bin = () => { let dom, th; const f = (vals) => { const edges = th; const bins = []; for (let i = 0; i < edges.length - 1; i++) { const b = []; b.x0 = edges[i]; b.x1 = edges[i + 1]; bins.push(b); } vals.forEach((v) => { const b = bins.find((x) => v >= x.x0 && v < x.x1) || bins[bins.length - 1]; b.push(v); }); return bins; }; f.domain = (d) => { dom = d; return f; }; f.thresholds = (t) => { th = t; return f; }; return f; };
d3.interpolateRgb = () => () => '#000'; d3.scaleSequential = () => () => '#000'; d3.zip = (a, b) => a.map((x, i) => [x, b[i]]);

/* ---- fake DOM ---- */
class Node_ {
  constructor(tag) { this.tag = tag; this.nodeType = 1; this.children = []; this.attrs = {}; this.style = {}; this.className = ''; this._t = ''; this.listeners = {}; this.clientWidth = 900; this.hidden = false; this.value = ''; this.offsetParent = null; this.parentElement = null; this.classList = { toggle() {}, add() {}, remove() {} }; }
  append(...k) { k.forEach((c) => { if (typeof c === 'string') c = new Text_(c); c.parentElement = this; this.children.push(c); }); }
  prepend(c) { c.parentElement = this; this.children.unshift(c); }
  replaceChildren(...k) { this.children = []; this.append(...k); }
  setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  remove() {} after() {} replaceWith() {} contains() { return true; } focus() {} blur() {} select() {} querySelectorAll() { return []; } getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 600 }; }
  set textContent(v) { this.children = []; this._t = v; } get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }
  getComputedTextLength() { return (this._t || '').length * 6; }
  get offsetWidth() { return 100; } get offsetHeight() { return 50; }
}
class Text_ { constructor(t) { this.nodeType = 3; this._t = String(t); } get textContent() { return this._t; } }
const root = new Node_('div');
const document = { createElement: (t) => new Node_(t), createElementNS: (n, t) => new Node_(t), createTextNode: (t) => new Text_(t), getElementById: (id) => (id === 'f1' ? root : null), addEventListener() {}, querySelectorAll: () => [] };
const errors = [];
const dash = { data: (id) => ({ status: 'ok', data: tables[id] }), onData: (f) => { dash._cb = f; }, setLink() {} };
const sandbox = { document, d3, dash, console, queueMicrotask, performance, location: { hash: '' }, setTimeout, clearTimeout, Math, Map, Set, JSON, isFinite, Number, String, Array, Object, Date, Intl };
sandbox.window = sandbox; sandbox.scrollTo = () => {}; sandbox.scrollY = 0;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
['core.js', 'ui.js'].forEach(load);
// stub chart kit: record calls, no drawing (needs real d3 + svg)
const F1 = sandbox.F1; const drawn = {};
Object.keys(F1.charts).forEach((k) => { F1.charts[k] = (host, o) => { drawn[k] = (drawn[k] || 0) + 1; if (k === 'hbars' && o.items.some((i) => !isFinite(i.value))) errors.push('hbars NaN value'); if (k === 'columns') o.data.forEach((d) => { if (d.v !== undefined && d.v !== null && !isFinite(d.v)) errors.push('columns NaN v ' + d.k); }); if (k === 'line') o.series.forEach((s) => s.data.forEach((p) => { if (p[1] != null && !isFinite(p[1])) errors.push('line NaN ' + s.name + ' ' + p[0]); })); }; });
['pages1.js', 'pages2.js', 'pages3.js', 'main.js'].forEach(load);
module.exports = { sandbox, F1, errors, drawn, tables, Node_, root };
