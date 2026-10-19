// Removes superseded measures (by name) from TMDL tables. Usage: node remove-old.js "<.../definition>"
const fs = require('fs'), path = require('path');
const T = path.join(process.argv[2], 'tables');
const gone = { 'DQ Tables': ['DQ Table Status Color'], 'DQ Raw Profile': ['DQ Profile Status Color'], 'DQ Columns': ['DQ Missing Status Color'], 'Race Results': ['Standings Gap Status Color'] };
for (const [tbl, names] of Object.entries(gone)) {
  const f = path.join(T, tbl + '.tmdl');
  let lines = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
  for (const n of names) {
    const rx = new RegExp(`^\tmeasure '?${n}'?( =|$)`);
    const at = lines.findIndex((l) => rx.test(l));
    if (at < 0) { console.log(tbl, n, 'not found'); continue; }
    let start = at; while (start > 0 && lines[start - 1].startsWith('\t///')) start--;
    let end = at; while (end < lines.length && lines[end] !== '') end++;
    lines.splice(start, end - start + 1);
    console.log(tbl, 'removed', n);
  }
  fs.writeFileSync(f, lines.join('\n').replace(/\n/g, '\r\n'));
}
