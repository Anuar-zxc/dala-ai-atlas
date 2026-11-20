import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
const limits = {name:100,url:350,sector:100,team:350,description:1200,audience:400,geo:350,stage:120};
export default async function handler(req,res) {
  if(req.method !== 'POST') return res.setHeader('Allow','POST').status(405).end();
  if(!req.headers['content-type']?.startsWith('application/json')) return res.status(415).end();
  if(Number(req.headers['content-length'])>20000) return res.status(413).end();
  const entry = {};
  for(const [key,max] of Object.entries(limits)) {
    const val=req.body?.[key] ?? '';
    if(typeof val!=='string' || val.length>max || (key!=='stage' && !val.trim())) return res.status(400).end();
    entry[key]=val.trim();
  }
  try { if(!['https:','http:'].includes(new URL(entry.url).protocol)) throw Error(); }
  catch { return res.status(400).end(); }
  const id=createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  try {
    await put('pending/'+id+'.json',JSON.stringify(entry),{access:'private',allowOverwrite:true,addRandomSuffix:false,contentType:'application/json'});
    return res.status(201).json({id});
  } catch {return res.status(503).json({error:'Storage unavailable'});}
}
