import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
const rows=JSON.parse(await readFile('public/startups.json','utf8'));
assert(rows.length>0);
assert.equal(new Set(rows.map(p=>p.id)).size,rows.length);
for(const p of rows) {
  for(const k of ['name','team','role','description','audience','geo','stage','sector','checked']) assert(p[k]?.trim(),p.id+' '+k);
  assert(/^[a-z0-9-]+$/.test(p.id));
  assert(Object.keys(p.links).length);
  for(const url of Object.values(p.links)) assert(['http:','https:'].includes(new URL(url).protocol));
  if(p.logo) await access('public/'+p.logo);
}
console.log(rows.length+' profiles verified');
