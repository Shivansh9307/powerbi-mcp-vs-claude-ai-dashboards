// Shared helpers for the F1 Evolution report generator (PBIR encoding, shell, visual builders).
// Storytelling-with-data pass: grey for context, ONE amber accent for what matters, no panels, no gridlines, action titles.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VC_SCHEMA = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json';
const AMBER = '#F5B301';
const C = {
  page: '#0F1115', surface: '#181B21', surfaceAlt: '#14171C', header: '#14171C', line: '#262B33', border: '#2A2F38',
  text: '#F2F2F2', text2: '#C9CED6', muted: '#9AA3AF', ctx: '#5B6470', light: '#8A94A3',
  amber: AMBER,
  // legacy colour names now map to neutral greys: only amber carries meaning
  red: '#8A94A3', cyan: '#8A94A3', green: '#8A94A3', violet: '#8A94A3', orange: AMBER, blue: '#8A94A3', grey: '#5B6470'
};
const PALETTE = [AMBER, '#C9CED6', '#8A94A3', '#5B6470', '#3A404A', '#2A2F38', '#1D2128', '#F2F2F2'];

// ---------- PBIR encoding ----------
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${String(s).replace(/'/g, "''")}'`);
const bool = (b) => lit(b ? 'true' : 'false');
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const fill = (hex) => ({ solid: { color: str(hex) } });
const id = { id: 'default' };
const colRef = (e, p) => ({ Column: { Expression: { SourceRef: { Entity: e } }, Property: p } });
const measRef = (e, p) => ({ Measure: { Expression: { SourceRef: { Entity: e } }, Property: p } });
const proj = (kind, e, p, extra = {}) => ({ field: kind === 'm' ? measRef(e, p) : colRef(e, p), queryRef: `${e}.${p}`, nativeQueryRef: p, ...extra });
const uid = () => crypto.randomBytes(10).toString('hex');
const zeroPad = { properties: { top: num(0), bottom: num(0), left: num(0), right: num(0) } };
const noBox = { background: [{ properties: { show: bool(false) } }], border: [{ properties: { show: bool(false) } }], padding: [zeroPad] };
// colour driven by a measure that returns a hex string (amber for the story point, grey for the rest)
const measureFill = (e, p) => ({ solid: { color: { expr: { Measure: { Expression: { SourceRef: { Entity: e } }, Property: p } } } } });

// visual container objects: action title (static text or measure), alt text, tooltip page. No panel, no border.
function vco({ title, alt, tooltipPage, titleSize } = {}) {
  const o = { background: [{ properties: { show: bool(false) } }], border: [{ properties: { show: bool(false) } }] };
  if (title) {
    const text = typeof title === 'string' ? str(title) : { expr: { Measure: { Expression: { SourceRef: { Entity: title.m[0] } }, Property: title.m[1] } } };
    o.title = [{ properties: { show: bool(true), text, fontColor: fill(C.text), fontSize: num(titleSize || 13), titleWrap: bool(true) } }];
    o.subTitle = [{ properties: { show: bool(false) } }];
  }
  if (alt) o.general = [{ properties: { altText: str(alt) } }];
  if (tooltipPage) o.visualTooltip = [{ properties: { show: bool(true), type: str('Canvas'), section: str(tooltipPage) } }];
  return o;
}

// ---------- filters ----------
const fid = () => crypto.randomBytes(10).toString('hex');
const measureFilter = (entity, prop, kind, n) => ({
  name: fid(), field: measRef(entity, prop), type: 'Advanced',
  filter: { Version: 2, From: [{ Name: 'd', Entity: entity, Type: 0 }], Where: [{ Condition: { Comparison: { ComparisonKind: kind, Left: { Measure: { Expression: { SourceRef: { Source: 'd' } }, Property: prop } }, Right: { Literal: { Value: `${n}L` } } } } }] },
  howCreated: 'User'
});
const colFilter = (entity, prop, values, type = 'Categorical') => ({
  name: fid(), field: colRef(entity, prop), type,
  filter: { Version: 2, From: [{ Name: 'd', Entity: entity, Type: 0 }], Where: [{ Condition: { In: { Expressions: [{ Column: { Expression: { SourceRef: { Source: 'd' } }, Property: prop } }], Values: values.map((v) => [{ Literal: { Value: typeof v === 'boolean' ? `${v}` : typeof v === 'number' ? `${v}L` : `'${String(v).replace(/'/g, "''")}'` } }]) } } }] },
  howCreated: 'User'
});
const notBlankFilter = (entity, prop) => ({ name: fid(), field: colRef(entity, prop), type: 'Advanced', filter: { Version: 2, From: [{ Name: 'd', Entity: entity, Type: 0 }], Where: [{ Condition: { Not: { Expression: { Comparison: { ComparisonKind: 0, Left: { Column: { Expression: { SourceRef: { Source: 'd' } }, Property: prop } }, Right: { Literal: { Value: 'null' } } } } } } }] }, howCreated: 'User' });
const winnersFilter = () => colFilter('Race Results', 'Finish Position', [1]);
const colRangeFilter = (entity, prop, lo, hi) => ({
  name: fid(), field: colRef(entity, prop), type: 'Advanced',
  filter: { Version: 2, From: [{ Name: 'd', Entity: entity, Type: 0 }], Where: [{ Condition: { And: { Left: { Comparison: { ComparisonKind: 2, Left: { Column: { Expression: { SourceRef: { Source: 'd' } }, Property: prop } }, Right: { Literal: { Value: `${lo}L` } } } }, Right: { Comparison: { ComparisonKind: 4, Left: { Column: { Expression: { SourceRef: { Source: 'd' } }, Property: prop } }, Right: { Literal: { Value: `${hi}L` } } } } } } }] },
  howCreated: 'User'
});

// ---------- geometry ----------
const W = 1920, H = 1080;
const RAIL = 264, X0 = 288, CW = 1600, G = 16;

function newPage(name) {
  const visuals = [];
  let z = 1000, tab = 0;
  return {
    name, visuals, interactions: [],
    add(label, x, y, w, h, visual, filterConfig) {
      const v = { $schema: VC_SCHEMA, name: uid(), position: { x: Math.round(x), y: Math.round(y), z: z += 100, height: Math.round(h), width: Math.round(w), tabOrder: tab += 100 }, visual };
      if (filterConfig) v.filterConfig = filterConfig;
      visuals.push({ label, json: v });
      return v.name;
    }
  };
}

// ---------- building blocks ----------
// text is never smaller than 13 px (about 10 pt)
function textbox(p, label, x, y, w, h, paras, alt, extra = {}) {
  return p.add(label, x, y, w, h, {
    visualType: 'textbox',
    objects: { general: [{ properties: { paragraphs: paras.map((r) => ({ textRuns: [{ value: r.t, textStyle: { fontFamily: r.font || 'Segoe UI', fontSize: `${Math.max(r.size || 14, 13)}px`, color: r.color || C.text, ...(r.bold ? { fontWeight: 'bold' } : {}) } }], horizontalTextAlignment: r.align || 'left' })) } }] },
    visualContainerObjects: {
      background: [{ properties: { show: bool(!!extra.bg), ...(extra.bg ? { color: fill(extra.bg), transparency: num(0) } : {}) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: [{ properties: { top: num(extra.padTop ?? 0), bottom: num(extra.padBottom ?? 0), left: num(extra.padLeft ?? 0), right: num(extra.padRight ?? 0) } }],
      general: [{ properties: { altText: str(alt || paras.map((r) => r.t).join(' ')) } }]
    }
  });
}

function rectShape(p, label, x, y, w, h, color, alt = 'Decorative shape') {
  return p.add(label, x, y, w, h, {
    visualType: 'shape',
    objects: { shape: [{ properties: { tileShape: str('rectangle') } }], fill: [{ properties: { fillColor: fill(color), transparency: num(0) }, selector: id }], outline: [{ properties: { show: bool(false) }, selector: id }] },
    visualContainerObjects: { ...noBox, general: [{ properties: { altText: str(alt) } }] }
  });
}

// card: a number or a sentence. No fill, no accent bar unless asked.
function card(p, label, x, y, w, h, o) {
  const { m, labelText, color = C.ctx, alt, size = 24, fillColor = null, accent = 'none', textColor = C.text, align = 'left', wrap = false, showLabel = true, labelSize = 12, padding = 8, display } = o;
  const objects = {
    value: [{ properties: { fontSize: num(size), fontColor: fill(textColor), bold: bool(size >= 20), horizontalAlignment: str(align), ...(wrap ? { textWrap: bool(true) } : {}), ...(display === 'none' ? { labelDisplayUnits: num(1), labelPrecision: int(0) } : {}) }, selector: id }],
    label: [{ properties: { show: bool(showLabel), ...(labelText ? { text: str(labelText) } : {}), fontSize: num(labelSize), fontColor: fill(C.muted), horizontalAlignment: str(align) }, selector: id }],
    fillCustom: [{ properties: { show: bool(!!fillColor), ...(fillColor ? { fillColor: fill(fillColor) } : {}), transparency: num(0) }, selector: id }],
    accentBar: [{ properties: { show: bool(accent !== 'none'), position: str(accent === 'none' ? 'Top' : accent), width: num(4), color: fill(color || C.ctx) }, selector: id }],
    outline: [{ properties: { show: bool(false) }, selector: id }],
    padding: [{ properties: { paddingUniform: num(padding) }, selector: id }],
    layout: [{ properties: { paddingUniform: num(0) }, selector: id }]
  };
  return p.add(label, x, y, w, h, {
    visualType: 'cardVisual',
    query: { queryState: { Data: { projections: m.map(([e, n, extra]) => proj('m', e, n, extra || {})) } } },
    objects,
    visualContainerObjects: {
      border: [{ properties: { show: bool(false) } }],
      background: [{ properties: { show: bool(false) } }],
      padding: [{ properties: { top: num(0), bottom: num(0), left: num(0), right: num(0) }, selector: id }],
      spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: id }],
      general: [{ properties: { altText: str(alt || labelText || m[0][1]) } }],
      ...(o.tooltipPage ? vco({ tooltipPage: o.tooltipPage }) : {})
    }
  });
}

// slicer; sync = group name; mode Dropdown | Between | Basic | Single
function slicer(p, label, x, y, w, h, o) {
  const { entity, prop, header, mode = 'Dropdown', sync, extra = {}, alt, selectAll = true, singleSelect = false, strict = true, noHeader = false, filter } = o;
  const visual = {
    visualType: 'slicer',
    query: { queryState: { Values: { projections: [proj('c', entity, prop)] } } },
    objects: {
      data: [{ properties: { mode: str(mode) } }],
      header: [{ properties: { show: bool(!noHeader), text: str(header), fontColor: fill(C.muted), textSize: num(11) } }],
      items: [{ properties: { fontColor: fill(C.text), background: fill(C.surface), textSize: num(12) } }],
      ...(mode === 'Dropdown' && !singleSelect && selectAll ? { selection: [{ properties: { selectAllCheckboxEnabled: bool(true) } }] } : {}),
      ...(singleSelect ? { selection: [{ properties: { singleSelect: bool(true), strictSingleSelect: bool(strict) } }] } : {}),
      ...(filter ? { general: [{ properties: { filter: { filter } } }] } : {}),
      ...extra
    },
    visualContainerObjects: {
      padding: [{ properties: { top: num(4), bottom: num(4), left: num(6), right: num(6) } }],
      general: [{ properties: { altText: str(alt || `${header} filter. The numbers, charts and insights on this page follow it.`) } }]
    }
  };
  if (sync) visual.syncGroup = { groupName: sync, fieldChanges: true, filterChanges: true };
  return p.add(label, x, y, w, h, visual);
}

// action button: outlined, quiet (page navigation, clear slicers, back)
function button(p, label, x, y, w, h, o) {
  const { text, action, target, textColor = C.text2, size = 12, alt, tooltip, outline = C.ctx } = o;
  const link = { show: bool(true), type: str(action), ...(tooltip ? { tooltip: str(tooltip) } : {}) };
  if (action === 'PageNavigation') link.navigationSection = str(target);
  return p.add(label, x, y, w, h, {
    visualType: 'actionButton',
    objects: {
      text: [{ properties: { show: bool(true) } }, { properties: { text: str(text), fontSize: num(size), fontColor: fill(textColor), horizontalAlignment: str('center'), bold: bool(true) }, selector: id }],
      icon: [{ properties: { show: bool(false) } }, { properties: { shapeType: str('rightArrow'), placement: str('left') }, selector: id }],
      fill: [{ properties: { show: bool(false) } }],
      outline: [{ properties: { show: bool(true) } }, { properties: { lineColor: fill(outline), weight: num(1) }, selector: id }],
      shape: [{ properties: { tileShape: str('rectangleRounded'), roundEdge: int(6) } }, { properties: { tileShape: str('rectangleRounded') }, selector: id }]
    },
    visualContainerObjects: { background: [{ properties: { show: bool(false) } }], border: [{ properties: { show: bool(false) } }], visualLink: [{ properties: link }], general: [{ properties: { altText: str(alt || text) } }] }
  });
}

const axisText = (size, color) => ({ fontSize: num(size), labelColor: fill(color), fontFamily: str('Segoe UI') });
// tables: data forward, hairline row separators only, no fills
function tableFormatting(fontSize = 11) {
  return {
    columnHeaders: [{ properties: { fontColor: fill(C.muted), backColor: fill(C.page), bold: bool(true), fontSize: num(fontSize), columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true) } }],
    values: [{ properties: { fontSize: num(fontSize), fontColorPrimary: fill(C.text2), fontColorSecondary: fill(C.text2), backColorPrimary: fill(C.page), backColorSecondary: fill(C.page) } }],
    grid: [{ properties: { rowPadding: num(4), gridHorizontal: bool(true), gridHorizontalColor: fill(C.line), gridHorizontalWeight: num(1), gridVertical: bool(false) } }]
  };
}
const leftAlign = (...qs) => qs.map((q) => ({ properties: { alignment: str('Left') }, selector: { metadata: q } }));

// table: cols = [kind, entity, prop, {displayName}]
function table(p, label, x, y, w, h, o) {
  const { cols, sort, title, alt, filters, tooltipPage, left = [], fontSize = 11, totals = false } = o;
  const query = { queryState: { Values: { projections: cols.map(([k, e, n, extra]) => proj(k, e, n, extra || {})) } } };
  if (sort) query.sortDefinition = { sort: [{ field: sort[0] === 'm' ? measRef(sort[1], sort[2]) : colRef(sort[1], sort[2]), direction: sort[3] || 'Descending' }], isDefaultSort: true };
  return p.add(label, x, y, w, h, {
    visualType: 'tableEx', query,
    objects: { ...tableFormatting(fontSize), total: [{ properties: { totals: bool(totals) } }], ...(left.length ? { columnFormatting: leftAlign(...left) } : {}) },
    visualContainerObjects: { ...vco({ title, alt, tooltipPage }), stylePreset: [{ properties: { name: str('None') } }] }
  }, filters ? { filters } : undefined);
}

// matrix (pivotTable)
function matrix(p, label, x, y, w, h, o) {
  const { rows, columns = [], values, title, alt, filters, extraObjects = {} } = o;
  const qs = { Rows: { projections: rows.map(([k, e, n, ex]) => proj(k, e, n, ex || {})) }, Values: { projections: values.map(([k, e, n, ex]) => proj(k, e, n, ex || {})) } };
  if (columns.length) qs.Columns = { projections: columns.map(([k, e, n, ex]) => proj(k, e, n, ex || {})) };
  return p.add(label, x, y, w, h, {
    visualType: 'pivotTable', query: { queryState: qs },
    objects: {
      columnHeaders: [{ properties: { fontColor: fill(C.muted), backColor: fill(C.page), bold: bool(true), fontSize: num(10) } }],
      rowHeaders: [{ properties: { fontColor: fill(C.text2), backColor: fill(C.page), fontSize: num(10) } }],
      values: [{ properties: { fontSize: num(10), fontColorPrimary: fill(C.text), backColorPrimary: fill(C.page), backColorSecondary: fill(C.page) } }],
      grid: [{ properties: { rowPadding: num(2), gridHorizontal: bool(false), gridVertical: bool(false) } }],
      ...extraObjects
    },
    visualContainerObjects: { ...vco({ title, alt }), stylePreset: [{ properties: { name: str('None') } }] }
  }, filters ? { filters } : undefined);
}

// cartesian charts. No gridlines, no value axis unless asked, grey by default, one amber point of focus.
// colorMeasure: [entity, measure] gives per-category colour (amber for the story, grey for the rest).
function chart(p, label, x, y, w, h, o) {
  const { type, cat, series, y: ys = [], y2 = [], tooltips = [], title, alt, filters, sort, colors = [], legend = false, labels = true, tooltipPage,
    axisTitle, scalar = false, dashed = [], valueAxisShow = false, lineWidth = 2.5, labelPrec = 0, catLabelSize = 10, extraObjects = {}, legendPos = 'Top', valueMin, colorMeasure } = o;
  const state = {};
  if (cat) state.Category = { projections: [proj(cat[0], cat[1], cat[2], { active: true })] };
  if (series) state.Series = { projections: [proj('c', series[0], series[1])] };
  state.Y = { projections: ys.map(([e, m, ex]) => proj('m', e, m, ex || {})) };
  if (y2.length) state.Y2 = { projections: y2.map(([e, m, ex]) => proj('m', e, m, ex || {})) };
  if (tooltips.length) state.Tooltips = { projections: tooltips.map(([e, m]) => proj('m', e, m)) };
  const query = { queryState: state };
  if (sort) query.sortDefinition = { sort: [{ field: sort[0] === 'm' ? measRef(sort[1], sort[2]) : colRef(sort[1], sort[2]), direction: sort[3] || 'Descending' }], isDefaultSort: true };
  const isLine = type === 'lineChart';
  const objects = {
    legend: [{ properties: { show: bool(legend), position: str(legendPos), labelColor: fill(C.muted), fontSize: num(10) } }],
    labels: [{ properties: { show: bool(labels), color: fill(C.text2), fontSize: num(10), labelDisplayUnits: num(1), labelPrecision: int(labelPrec), ...(isLine ? {} : { labelPosition: str('OutsideEnd') }) } }],
    categoryAxis: [{ properties: { ...axisText(catLabelSize, C.muted), gridlineShow: bool(false), showAxisTitle: bool(!!axisTitle), ...(axisTitle ? { titleText: str(axisTitle), titleColor: fill(C.muted), titleFontSize: num(10) } : {}), ...(scalar ? { axisType: str('Scalar') } : {}), ...(isLine ? {} : { innerPadding: num(o.innerPadding ?? (type.includes('Bar') ? 20 : 8)) }) } }],
    valueAxis: [{ properties: { ...axisText(10, C.muted), show: bool(valueAxisShow), gridlineShow: bool(false), showAxisTitle: bool(false), ...(valueMin !== undefined ? { start: num(valueMin) } : {}) } }],
    ...extraObjects
  };
  if (isLine) objects.lineStyles = [{ properties: { strokeWidth: num(lineWidth), lineChartType: str('linear'), showMarker: bool(false) } }, ...dashed.map(([e, m]) => ({ properties: { lineStyle: str('dashed') }, selector: { metadata: `${e}.${m}` } }))];
  if (colors.length) {
    const sel = colors.map(([e, m, color]) => ({ properties: { fill: fill(color) }, selector: { metadata: `${e}.${m}` } }));
    if (isLine) objects.lineStyles.push(...colors.map(([e, m, color]) => ({ properties: { strokeColor: fill(color) }, selector: { metadata: `${e}.${m}` } })));
    objects.dataPoint = [{ properties: { defaultColor: fill(colors.length === 1 ? colors[0][2] : C.ctx) } }, ...sel];
  }
  if (o.color) objects.dataPoint = [{ properties: { defaultColor: fill(o.color) } }];
  if (colorMeasure) objects.dataPoint = [{ properties: { defaultColor: fill(C.ctx) } }, { properties: { fill: measureFill(colorMeasure[0], colorMeasure[1]) }, selector: { data: [{ roles: ['Category'] }] } }];
  return p.add(label, x, y, w, h, { visualType: type, query, objects, visualContainerObjects: vco({ title, alt, tooltipPage }) }, filters ? { filters } : undefined);
}

function scatter(p, label, x, y, w, h, o) {
  const { cat, xm, ym, size, title, alt, filters, color = C.light, xTitle, yTitle } = o;
  const state = { Category: { projections: [proj('c', cat[0], cat[1], { active: true })] }, X: { projections: [proj('m', xm[0], xm[1])] }, Y: { projections: [proj('m', ym[0], ym[1])] } };
  if (size) state.Size = { projections: [proj('m', size[0], size[1])] };
  return p.add(label, x, y, w, h, {
    visualType: 'scatterChart', query: { queryState: state },
    objects: {
      legend: [{ properties: { show: bool(false) } }],
      dataPoint: [{ properties: { defaultColor: fill(color) } }],
      categoryAxis: [{ properties: { ...axisText(10, C.muted), gridlineShow: bool(false), showAxisTitle: bool(!!xTitle), ...(xTitle ? { titleText: str(xTitle), titleColor: fill(C.muted), titleFontSize: num(10) } : {}) } }],
      valueAxis: [{ properties: { ...axisText(10, C.muted), gridlineShow: bool(false), showAxisTitle: bool(!!yTitle), ...(yTitle ? { titleText: str(yTitle), titleColor: fill(C.muted), titleFontSize: num(10) } : {}) } }]
    },
    visualContainerObjects: vco({ title, alt })
  }, filters ? { filters } : undefined);
}

// ---------- page shell ----------
const NAV = [
  ['overview', 'Overview'], ['drivers', 'Driver Intelligence'], ['constructors', 'Constructor Analysis'], ['explorer', 'Race & Circuit Explorer'],
  ['quali', 'Qualifying & Race Performance'], ['pits', 'Pit Stop Analysis'], ['eras', 'F1 Through the Eras'], ['quality', 'Data Quality & Coverage']
];
const SHORT = { drivers: 'Drivers', constructors: 'Teams', explorer: 'Race explorer', quali: 'Qualifying', pits: 'Pit stops', eras: 'Eras', quality: 'Data quality' };
const SYNC = { era: 'f1_sync_era', seasons: 'f1_sync_seasons', driver: 'f1_sync_driver', constructor: 'f1_sync_constructor', circuit: 'f1_sync_circuit' };

const TESTMODE = process.env.F1_TEST || '';
const TESTS = {
  overview: { seasons: [2021, 2021] },
  drivers: { driver: ['Lewis Hamilton'], compare: ['Nico Rosberg'] },
  constructors: { cons: ['Ferrari'], compare: ['McLaren'], seasons: [2000, 2010] },
  explorer: { season_single: [2021], gp: ['British Grand Prix'], circuit: ['Silverstone Circuit'] },
  quali: { driver: ['Lewis Hamilton'] },
  pits: { seasons: [1988, 1988] },
  eras: { driver: ['Lewis Hamilton'], cons: ['Ferrari'], seasons: [1950, 1957] },
  quality: {}
};
const EMPTY = { overview: { driver: ['Lewis Hamilton'], cons: ['Ferrari'], seasons: [1950, 1957] } };
const tcfg = (page) => (TESTMODE === '1' ? TESTS[page] || {} : TESTMODE === 'empty' ? EMPTY[page] || {} : null);
// filter body for a slicer on a page in test mode (undefined otherwise)
const tf = (page, key, entity, prop) => { const t = tcfg(page); return t && t[key] ? colFilter(entity, prop, t[key]).filter : undefined; };
const tseason = (page) => { const t = tcfg(page); return t && t.seasons ? colRangeFilter('Season', 'Season', t.seasons[0], t.seasons[1]).filter : undefined; };
let PAGE_H = H;
const setPageHeight = (h) => { PAGE_H = h; };
// next page in the story, shown as a quiet button at the foot of the rail
let PAGE_IDS = {};
const setPageIds = (ids) => { PAGE_IDS = ids; };

function shell(p, o) {
  const { title, headline, filters = true, back = false } = o;
  if (!headline) throw new Error(`shell: page "${title}" needs a headline measure`);
  const idx = NAV.findIndex(([k]) => k === p.name);
  const next = idx >= 0 && idx < NAV.length - 1 ? NAV[idx + 1] : null;
  // left rail: hairline divider instead of a panel
  rectShape(p, 'rail_line', RAIL, 0, 1, PAGE_H, C.line, 'Divider between navigation and content');
  textbox(p, 'brand', 24, 24, 216, 88, [{ t: 'F1 EVOLUTION', size: 24, font: 'Segoe UI Semibold', color: C.text }, { t: 'How the grid took over, 1950–2026', size: 13, color: C.muted }], 'F1 Evolution. How the grid took over, 1950 to 2026');
  rectShape(p, 'brand_rule', 24, 118, 40, 4, C.amber, 'Decorative accent rule');
  p.add('page_nav', 16, 140, 232, 8 * 46 + 8, {
    visualType: 'pageNavigator',
    objects: {
      layout: [{ properties: { orientation: num(1), rowCount: int(8), columnCount: int(1), cellPadding: num(6) } }],
      shape: [{ properties: { tileShape: str('rectangleRounded'), roundEdge: int(6) } }],
      fill: [{ properties: { show: bool(true), fillColor: fill(C.page) } }, { properties: { fillColor: fill(C.page) }, selector: { id: 'default' } }, { properties: { fillColor: fill(C.surface) }, selector: { id: 'hover' } }, { properties: { fillColor: fill(C.surface) }, selector: { id: 'selected' } }],
      text: [{ properties: { show: bool(true), fontFamily: str('Segoe UI Semibold'), fontSize: num(12), fontColor: fill(C.muted), horizontalAlignment: str('left') } }, { properties: { fontColor: fill(C.muted) }, selector: { id: 'default' } }, { properties: { fontColor: fill(C.text) }, selector: { id: 'hover' } }, { properties: { fontColor: fill(C.amber) }, selector: { id: 'selected' } }],
      outline: [{ properties: { show: bool(false) } }, { properties: { show: bool(false) }, selector: { id: 'default' } }],
      pages: [{ properties: { showHiddenPages: bool(false), showTooltipPages: bool(false), showByDefault: bool(true) } }]
    },
    visualContainerObjects: { ...noBox, general: [{ properties: { altText: str('Page navigation: eight pages, the current page is shown in amber') } }] }
  });
  textbox(p, 'rail_note', 24, 990, 216, 70, [{ t: 'Season, driver, constructor and circuit filters stay in sync on every page.', size: 13, color: C.muted }], 'Note: filters stay in sync across pages');
  if (next && PAGE_IDS[next[0]]) button(p, 'next_page', 24, back ? 934 : 920, 216, 40, { text: `Next: ${SHORT[next[0]]} →`, action: 'PageNavigation', target: PAGE_IDS[next[0]], size: 12, alt: `Next page in the story: ${next[1]}` });
  // top band: title, active filters, action headline, partial-season banner
  textbox(p, 'page_title', X0, 8, 760, 44, [{ t: title, size: 24, font: 'Segoe UI Semibold', color: C.text }], `Page title: ${title}`);
  card(p, 'active_filters', 1056, 14, 832, 36, { m: [['Race Results', 'Active Filters']], showLabel: false, size: 13, textColor: C.muted, align: 'right', padding: 2, alt: 'Active filters line: the seasons and selections every number on this page follows' });
  card(p, 'headline', X0, 50, CW, 40, { m: [[headline === 'Headline Data Quality' ? 'DQ Tables' : 'Race Results', headline]], showLabel: false, size: 18, textColor: C.text, padding: 2, alt: 'Action headline: the finding this page supports, built from the current selection' });
  card(p, 'banner', X0, 90, CW, 24, { m: [['Race Results', 'Partial Season Banner']], showLabel: false, size: 13, textColor: C.amber, padding: 2, alt: 'Warning shown only when the selection includes a season still in progress' });
  if (filters) {
    const y = 116, h = 76, gap = 12;
    let x = X0;
    const test = tcfg(p.name) !== null;
    const add = (label, w, o2) => { slicer(p, label, x, y, w, h, test ? { ...o2, sync: undefined } : o2); x += w + gap; };
    add('slicer_era', 170, { entity: 'Season', prop: 'Era', header: 'Era', sync: SYNC.era, filter: tf(p.name, 'era', 'Season', 'Era') });
    add('slicer_seasons', 330, { entity: 'Season', prop: 'Season', header: 'Season range', mode: 'Between', sync: SYNC.seasons, filter: tseason(p.name), extra: { slider: [{ properties: { show: bool(true), color: fill(C.amber) } }], numericInputStyle: [{ properties: { fontColor: fill(C.text), background: fill(C.surface), textSize: num(12) } }] }, alt: 'From and to season. All numbers on this page follow it.' });
    add('slicer_driver', 264, { entity: 'Driver', prop: 'Driver', header: 'Driver', sync: SYNC.driver, filter: tf(p.name, 'driver', 'Driver', 'Driver') });
    add('slicer_constructor', 264, { entity: 'Constructor', prop: 'Constructor', header: 'Constructor', sync: SYNC.constructor, filter: tf(p.name, 'cons', 'Constructor', 'Constructor') });
    add('slicer_circuit', 264, { entity: 'Circuit', prop: 'Circuit', header: 'Circuit', sync: SYNC.circuit, filter: tf(p.name, 'circuit', 'Circuit', 'Circuit') });
    button(p, 'reset_filters', X0 + CW - 120, y + 20, 120, 36, { text: 'Reset filters', action: 'ClearAllSlicers', tooltip: 'Clear every filter', alt: 'Reset filters: clears all slicers so the whole report shows every season again' });
  }
  if (back) button(p, 'back_button', 24, 880, 216, 40, { text: '← Back', action: 'Back', alt: 'Back to the page you came from' });
}
const BODY_Y = 200;

module.exports = {
  fs, path, VC_SCHEMA, C, PALETTE, AMBER, lit, str, bool, num, int, fill, id, colRef, measRef, proj, uid, zeroPad, noBox, vco, measureFill,
  tf, tcfg, tseason, fid, setPageHeight, setPageIds, notBlankFilter, measureFilter, colFilter, winnersFilter, colRangeFilter, W, H, RAIL, X0, CW, G, newPage, textbox, rectShape, card, slicer, button,
  axisText, tableFormatting, leftAlign, table, matrix, chart, scatter, NAV, SYNC, shell, BODY_Y
};
