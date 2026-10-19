// Injects (or replaces) the storytelling-pass measures in the TMDL files. Usage: node apply-story.js "<.../definition>"
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const def = process.argv[2];
const tablesDir = path.join(def, 'tables');
const defs = require('./defs-story.js');
const T = '\t';
const guid = () => crypto.randomUUID();
const q = (n) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
const oneLine = (s) => s.replace(/\s*\r?\n\s*/g, ' ').trim();
const ind = (s, n) => s.split('\n').map((l) => T.repeat(n) + l).join('\n');
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(f, s.replace(/\n/g, '\r\n'));

function block(o, keepTag) {
  const head = o.expr.includes('\n') ? `${T}measure ${q(o.name)} =\n${ind(o.expr, 3)}` : `${T}measure ${q(o.name)} = ${o.expr}`;
  const props = [`${T}${T}formatString: ${o.fmt || '@'}`];
  if (o.hidden) props.push(`${T}${T}isHidden`);
  if (o.folder) props.push(`${T}${T}displayFolder: ${o.folder}`);
  props.push(`${T}${T}lineageTag: ${keepTag || guid()}`);
  return `${T}/// ${oneLine(o.desc)}\n${head}\n${props.join('\n')}\n`;
}

for (const [table, list] of Object.entries(defs)) {
  const file = path.join(tablesDir, `${table}.tmdl`);
  let lines = read(file).split('\n');
  let added = 0, replaced = 0;
  const fresh = [];
  for (const o of list) {
    const rx = new RegExp(`^\\tmeasure ${q(o.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( =|$)`);
    const at = lines.findIndex((l) => rx.test(l));
    if (at < 0) { fresh.push(block(o)); added++; continue; }
    // replace in place: find doc-comment start and the end of the block (next blank line), keep the lineage tag
    let start = at; while (start > 0 && lines[start - 1].startsWith(`${T}///`)) start--;
    let end = at; while (end < lines.length && lines[end] !== '') end++;
    const tag = (lines.slice(at, end).find((l) => l.includes('lineageTag:')) || '').split('lineageTag:')[1];
    const rep = block(o, tag ? tag.trim() : undefined).replace(/\n$/, '').split('\n');
    lines.splice(start, end - start, ...rep);
    replaced++;
  }
  let s = lines.join('\n');
  if (fresh.length) {
    const i = s.search(/^\t(\/\/\/|measure |column |partition )/m);
    s = s.slice(0, i) + fresh.join('\n') + '\n' + s.slice(i);
  }
  write(file, s);
  console.log(`${table}: +${added} new, ${replaced} replaced`);
}
