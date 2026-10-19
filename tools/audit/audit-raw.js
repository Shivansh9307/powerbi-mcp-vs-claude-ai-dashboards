const fs=require('fs'),path=require('path');
const dir = (process.argv[2] || 'data/raw').replace(/[\\/]+$/, '') + '/'; // usage: node audit-raw.js <raw CSV folder>
function csv(f){const t=fs.readFileSync(dir+f,'utf8').replace(/^\uFEFF/,'');const rows=[];let row=[],cur='',q=false;
for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){cur+='"';i++}else q=false}else cur+=c}else if(c=='"')q=true;else if(c==','){row.push(cur);cur=''}else if(c=='\n'){row.push(cur.replace(/\r$/,''));rows.push(row);row=[];cur=''}else cur+=c}
if(cur||row.length){row.push(cur);rows.push(row)}const h=rows.shift();return rows.filter(r=>r.length==h.length).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))}
const res=csv('results.csv'),races=csv('races.csv'),st=csv('status.csv');
const nd=res.filter(r=>r.positionText=='F'||r.positionText=='W');
const starters=res.filter(r=>!(r.positionText=='F'||r.positionText=='W'));
console.log('rows',res.length,'non-starters(F/W)',nd.length);
console.log('distinct drivers all',new Set(res.map(r=>r.driverId)).size,'starters',new Set(starters.map(r=>r.driverId)).size);
console.log('distinct cons all',new Set(res.map(r=>r.constructorId)).size,'starters',new Set(starters.map(r=>r.constructorId)).size);
const ptxt={};res.forEach(r=>{const k=/^\d+$/.test(r.positionText)?'digit':r.positionText;ptxt[k]=(ptxt[k]||0)+1});console.log('positionText',ptxt);
const bad=res.filter(r=>!/^\d+$/.test(r.positionText)&&r.position!=='\N');console.log('position filled but positionText non-digit',bad.length);
const yr=new Map(races.map(r=>[r.raceId,r.year]));const by={};bad.forEach(r=>{const y=yr.get(r.raceId);by[y]=(by[y]||0)+1});console.log(by);
console.log('grid0',res.filter(r=>r.grid=='0').length,'gridNull',res.filter(r=>r.grid=='\N').length);
const sn=Object.fromEntries(st.map(s=>[s.statusId,s.status]));console.log('status names',st.length);
// distinct statuses among DNS rows
const dsStat={};nd.forEach(r=>{dsStat[sn[r.statusId]]=(dsStat[sn[r.statusId]]||0)+1});console.log('status of F/W rows',dsStat);
const lap=csv('lap_times.csv');const seen=new Set();let dup=0;lap.forEach(r=>{const k=r.raceId+'|'+r.driverId+'|'+r.lap;if(seen.has(k))dup++;else seen.add(k)});console.log('lap rows',lap.length,'dups',dup);
