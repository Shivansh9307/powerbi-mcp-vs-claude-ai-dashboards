// Injects the page-support model objects into the PBIP semantic model files (TMDL), without a live Desktop session.
// Usage: node apply.js "<.../F1 Dataset.SemanticModel/definition>"
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const def = process.argv[2];
const tablesDir = path.join(def, 'tables');
const cols = require('./defs-cols.js');
const measures = require('./defs-measures.js');
const newTables = require('./defs-tables.js');
const T = '\t';
const guid = () => crypto.randomUUID();
const q = (n) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
const oneLine = (s) => s.replace(/\s*\r?\n\s*/g, ' ').trim();
const expr = (s, indent) => s.split('\n').map((l) => T.repeat(indent) + l).join('\n');
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(f, s.replace(/\n/g, '\r\n'));

function measureBlock(o) {
  const head = o.expr.includes('\n') ? `${T}measure ${q(o.name)} =\n${expr(o.expr, 3)}` : `${T}measure ${q(o.name)} = ${o.expr}`;
  const props = [];
  if (!o.fmtExpr && o.fmt) props.push(`${T}${T}formatString: ${o.fmt}`);
  if (o.hidden) props.push(`${T}${T}isHidden`);
  if (o.folder) props.push(`${T}${T}displayFolder: ${o.folder}`);
  props.push(`${T}${T}lineageTag: ${guid()}`);
  // a dynamic format string is a nested expression and must come last
  if (o.fmtExpr) props.push(`${T}${T}formatStringDefinition = ${o.fmtExpr}`);
  return `${T}/// ${oneLine(o.desc)}\n${head}\n${props.join('\n')}\n`;
}
function columnBlock(o) {
  const head = o.expr.includes('\n') ? `${T}column ${q(o.name)} =\n${expr(o.expr, 3)}` : `${T}column ${q(o.name)} = ${o.expr}`;
  const props = [`${T}${T}dataType: ${o.type}`];
  if (o.hidden) props.push(`${T}${T}isHidden`);
  if (o.fmt) props.push(`${T}${T}formatString: ${o.fmt}`);
  props.push(`${T}${T}lineageTag: ${guid()}`, `${T}${T}summarizeBy: none`);
  if (o.sort) props.push(`${T}${T}sortByColumn: ${q(o.sort)}`);
  return `${T}/// ${oneLine(o.desc)}\n${head}\n${props.join('\n')}\n`;
}

function inject(table, { newMeasures = [], newCols = [] }) {
  const file = path.join(tablesDir, `${table}.tmdl`);
  let s = read(file);
  const names = (rx) => [...s.matchAll(rx)].map((m) => m[1].replace(/^'|'$/g, '').replace(/''/g, "'"));
  const have = new Set([...names(/^\tmeasure ('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_]*)/gm), ...names(/^\tcolumn ('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_]*)/gm)]);
  const mAdd = newMeasures.filter((m) => !have.has(m.name));
  const cAdd = newCols.filter((c) => !have.has(c.name));
  if (mAdd.length) {
    const i = s.search(/^\t(\/\/\/|measure |column |partition )/m);
    s = s.slice(0, i) + mAdd.map(measureBlock).join('\n') + '\n' + s.slice(i);
  }
  if (cAdd.length) {
    const i = s.search(/^\tpartition /m);
    s = s.slice(0, i) + cAdd.map(columnBlock).join('\n') + '\n' + s.slice(i);
  }
  write(file, s);
  console.log(`${table}: +${mAdd.length} measures, +${cAdd.length} columns` + (newMeasures.length - mAdd.length + newCols.length - cAdd.length ? ' (skipped existing)' : ''));
}

const tableNames = new Set([...Object.keys(cols), ...Object.keys(measures)]);
for (const t of tableNames) inject(t, { newMeasures: measures[t] || [], newCols: cols[t] || [] });

// ----- new tables -----
const header = (t) => `/// ${oneLine(t.desc)}\ntable ${q(t.name)}\n${T}lineageTag: ${guid()}\n`;
for (const t of newTables) {
  const file = path.join(tablesDir, `${t.name}.tmdl`);
  if (fs.existsSync(file)) { console.log(`${t.name}: exists, skipped`); continue; }
  let s = header(t) + '\n';
  if (t.measures.length) s += t.measures.map(measureBlock).join('\n') + '\n';
  if (t.kind === 'calculated') {
    s += t.columns.map((c) => `${T}column ${q(c.name)}\n${T}${T}lineageTag: ${guid()}\n${T}${T}isNameInferred\n${T}${T}sourceColumn: [${c.name}]\n`).join('\n');
    s += `\n${T}partition ${q(t.name)} = calculated\n${T}${T}mode: import\n${T}${T}source =\n${expr(t.expr, 4)}\n`;
  } else {
    s += t.columns.map((c) => `${T}column ${q(c.name)}\n${T}${T}dataType: ${c.type}\n${c.fmt ? `${T}${T}formatString: ${c.fmt}\n` : ''}${T}${T}lineageTag: ${guid()}\n${T}${T}summarizeBy: ${c.summarize}\n${T}${T}sourceColumn: ${c.name}\n`).join('\n');
    s += `\n${T}partition ${q(t.name)} = m\n${T}${T}mode: import\n${T}${T}source =\n${expr(t.expr, 4)}\n\n${T}annotation PBI_ResultType = Table\n`;
  }
  write(file, s);
  console.log(`${t.name}: table written (${t.measures.length} measures)`);
}

// ----- model.tmdl: register tables -----
const modelFile = path.join(def, 'model.tmdl');
let model = read(modelFile);
for (const t of newTables) {
  const ref = `ref table ${q(t.name)}`;
  if (!model.includes(ref)) model = model.replace(/\nref cultureInfo/, `\n${ref}\nref cultureInfo`).replace(/(ref table [^\n]+\n)(\nref cultureInfo)/, '$1$2');
}
write(modelFile, model);
console.log('model.tmdl updated');
