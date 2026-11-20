import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import { locations, stages } from '../public/fields.js';
import { webUrl } from '../lib/validation.js';
const rows=JSON.parse(await readFile('public/startups.json','utf8'));
assert(rows.length>0);
assert.equal(new Set(rows.map(p=>p.id)).size,rows.length);
for(const p of rows) {
  for(const k of ['name','team','role','description','audience','geo','stage','sector','checked']) assert(p[k]?.trim(),p.id+' '+k);
  assert(/^[a-z0-9-]+$/.test(p.id));
  assert(Object.keys(p.links).length);
  for(const url of Object.values(p.links)) assert(['http:','https:'].includes(new URL(url).protocol));
  for (const city of [p.city, p.programCity, ...(p.alsoCities || [])].filter(Boolean)) {
    assert(Object.hasOwn(locations, city), p.id + ' city');
  }
  if (p.stageKey) assert(Object.hasOwn(stages, p.stageKey), p.id + ' stage');
  for (const { label, url } of p.contacts || []) {
    assert(label?.trim() && (webUrl(url) || /^mailto:[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(url)), p.id + ' contact');
  }
  if(p.logo) await access('public/'+p.logo);
}
console.log(rows.length+' profiles verified');
