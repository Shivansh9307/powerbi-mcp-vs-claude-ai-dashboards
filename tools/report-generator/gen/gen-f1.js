// Generates the F1 Evolution PBIR report: node gen-f1.js "<.Report dir>" [themeGuid]
const L = require('./f1-lib.js');
const A = require('./pages-a.js');
let B = {}; try { B = require('./pages-b.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const { fs, path, C, PALETTE, str, num, fill, fid } = L;

const reportDir = process.argv[2];
const guid = process.argv[3] || 'f1evo001';
const defDir = path.join(reportDir, 'definition');
const pagesDir = path.join(defDir, 'pages');
const IDS = A.IDS;

const DRILL = { drivers: ['Driver', 'Driver'], constructors: ['Constructor', 'Constructor'], explorer: ['Season', 'Season'] };

const pages = [
  { id: IDS.overview, name: 'Overview', build: A.overview },
  { id: IDS.drivers, name: 'Driver Intelligence', build: A.drivers, drill: DRILL.drivers },
  { id: IDS.constructors, name: 'Constructor Analysis', build: A.constructors, drill: DRILL.constructors },
  ...(B.explorer ? [{ id: IDS.explorer, name: 'Race & Circuit Explorer', build: B.explorer, drill: DRILL.explorer, height: B.explorerHeight }] : []),
  ...(B.quali ? [{ id: IDS.quali, name: 'Qualifying & Race Performance', build: B.quali }] : []),
  ...(B.pits ? [{ id: IDS.pits, name: 'Pit Stop Analysis', build: B.pits }] : []),
  ...(B.eras ? [{ id: IDS.eras, name: 'F1 Through the Eras', build: B.eras }] : []),
  ...(B.quality ? [{ id: IDS.quality, name: 'Data Quality & Coverage', build: B.quality, height: B.qualityHeight }] : [])
];
const tooltipPages = A.tooltips();

function writePage({ id, name, build, drill, height, tooltip, size }) {
  const page = build ? build() : tooltip;
  const pageDir = path.join(pagesDir, id);
  const visualsDir = path.join(pageDir, 'visuals');
  fs.mkdirSync(pageDir, { recursive: true });
  fs.rmSync(visualsDir, { recursive: true, force: true });
  fs.mkdirSync(visualsDir, { recursive: true });
  for (const v of page.visuals) {
    const dir = path.join(visualsDir, v.json.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'visual.json'), JSON.stringify(v.json, null, 2) + '\n');
  }
  const pageFile = path.join(pageDir, 'page.json');
  const out = {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
    name: id, displayName: name,
    displayOption: size ? 'ActualSize' : (height ? 'FitToWidth' : 'FitToPage'),
    width: size ? size[0] : L.W, height: size ? size[1] : (height || L.H),
    objects: { background: [{ properties: { color: fill(C.page), transparency: num(0) } }], outspace: [{ properties: { color: fill(C.page), transparency: num(0) } }] }
  };
  if (page.interactions.length) out.visualInteractions = page.interactions;
  if (size) { out.visibility = 'HiddenInViewMode'; out.pageBinding = { name: 'Tooltip', type: 'Tooltip' }; }
  if (drill) {
    const filterName = fid(), paramName = `Param_${filterName}`;
    const field = { Column: { Expression: { SourceRef: { Entity: drill[0] } }, Property: drill[1] } };
    out.filterConfig = { filters: [{ name: filterName, field, type: 'Categorical', howCreated: 'Drillthrough' }] };
    out.pageBinding = { name: 'Pod', type: 'Drillthrough', parameters: [{ name: paramName, boundFilter: filterName, fieldExpr: field }] };
  }
  fs.writeFileSync(pageFile, JSON.stringify(out, null, 2) + '\n');
  console.log(`${name}: ${page.visuals.length} visuals`);
}

// remove pages that are not part of this build (e.g. the retired Season Overview)
const keep = new Set([...pages.map((p) => p.id), ...tooltipPages.map((t) => t.id)]);
for (const d of fs.readdirSync(pagesDir, { withFileTypes: true })) if (d.isDirectory() && !keep.has(d.name)) { fs.rmSync(path.join(pagesDir, d.name), { recursive: true, force: true }); console.log(`removed page folder ${d.name}`); }

// The rail shape must match the page height, so pass height through the lib via environment of the page builder
pages.forEach((pg) => { L.setPageHeight && L.setPageHeight(pg.height || L.H); writePage(pg); });
tooltipPages.forEach((t) => writePage({ id: t.id, name: t.display, tooltip: t, size: t.size }));

const pagesFile = path.join(pagesDir, 'pages.json');
const pj = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
pj.pageOrder = [...pages.map((p) => p.id), ...tooltipPages.map((t) => t.id)];
pj.activePageName = IDS.overview;
fs.writeFileSync(pagesFile, JSON.stringify(pj, null, 2) + '\n');

// ---------- theme ----------
const themeName = `F1BroadcastDark-${guid}.json`;
const solid = (hex) => ({ solid: { color: hex } });
const theme = {
  name: themeName,
  dataColors: [...PALETTE, '#4A525E', '#6B7480', '#A8B0BC', '#D7DBE1', '#3A404A'],
  foreground: C.text, foregroundNeutralSecondary: C.muted, foregroundNeutralTertiary: C.muted,
  background: C.page, backgroundLight: C.line, backgroundNeutral: C.header, tableAccent: C.amber, shapeStroke: C.border, disabledText: '#7B8494',
  good: '#C9CED6', neutral: C.amber, bad: '#FFFFFF', maximum: C.amber, center: '#5B6470', minimum: '#1D2128', null: C.muted, hyperlink: C.amber, visitedHyperlink: '#C9CED6',
  textClasses: {
    callout: { fontSize: 24, fontFace: 'Segoe UI Semibold', color: C.text }, title: { fontSize: 13, fontFace: 'Segoe UI Semibold', color: C.text },
    header: { fontSize: 12, fontFace: 'Segoe UI Semibold', color: C.text }, label: { fontSize: 10.5, fontFace: 'Segoe UI', color: C.text }
  },
  visualStyles: {
    '*': { '*': { background: [{ show: false }], border: [{ show: false }], title: [{ show: true, fontSize: 13, fontColor: solid(C.text), titleWrap: true }], subTitle: [{ show: false }], categoryAxis: [{ gridlineShow: false, labelColor: solid(C.muted) }], valueAxis: [{ gridlineShow: false, labelColor: solid(C.muted) }] } },
    textbox: { '*': { background: [{ show: false }], border: [{ show: false }], title: [{ show: false }], padding: [{ left: 0, top: 0, right: 0, bottom: 0 }] } },
    shape: { '*': { background: [{ show: false }], border: [{ show: false }], title: [{ show: false }], padding: [{ left: 0, top: 0, right: 0, bottom: 0 }] } },
    slicer: { '*': { background: [{ show: false }], border: [{ show: false }], title: [{ show: false }], padding: [{ left: 0, top: 0, right: 0, bottom: 0 }] } },
    cardVisual: { '*': { background: [{ show: false }], border: [{ show: false }] } },
    actionButton: { '*': { background: [{ show: false }], border: [{ show: false }] } },
    pageNavigator: { '*': { background: [{ show: false }], border: [{ show: false }] } }
  }
};
const resDir = path.join(reportDir, 'StaticResources', 'RegisteredResources');
fs.mkdirSync(resDir, { recursive: true });
for (const f of fs.readdirSync(resDir)) if (/^F1BroadcastDark-.*\.json$/.test(f)) fs.rmSync(path.join(resDir, f));
fs.writeFileSync(path.join(resDir, themeName), JSON.stringify(theme, null, 2) + '\n');
const reportFile = path.join(defDir, 'report.json');
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
report.themeCollection.customTheme = { name: themeName, reportVersionAtImport: report.themeCollection.baseTheme.reportVersionAtImport, type: 'RegisteredResources' };
report.resourcePackages = (report.resourcePackages || []).filter((p) => p.name !== 'RegisteredResources');
report.resourcePackages.push({ name: 'RegisteredResources', type: 'RegisteredResources', items: [{ name: themeName, path: themeName, type: 'CustomTheme' }] });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
// report display name
const platFile = path.join(reportDir, '.platform');
const plat = JSON.parse(fs.readFileSync(platFile, 'utf8'));
plat.metadata.displayName = 'F1 Evolution';
fs.writeFileSync(platFile, JSON.stringify(plat, null, 2) + '\n');
console.log(`theme ${themeName}`);
