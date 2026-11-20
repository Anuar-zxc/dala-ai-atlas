import { createHash } from 'node:crypto';
import { BlobError } from '@vercel/blob';
import { readJson, writeJson } from '../lib/atlas-storage.js';
import { isJson, sameOrigin, validateEntry } from '../lib/validation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.setHeader('Allow', 'POST').status(405).end();
  if (!isJson(req)) return res.status(415).end();
  if (!sameOrigin(req)) return res.status(403).end();
  if (Number(req.headers['content-length']) > 20000) return res.status(413).end();
  const entry = validateEntry(req.body, { submission: true });
  if (!entry) return res.status(400).json({ error: 'Проверьте обязательные поля и ссылки.' });
  const id = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  const path = 'pending/' + id + '.json';
  try {
    try {
      await writeJson(path, entry);
    } catch (error) {
      if (!(error instanceof BlobError) || !await readJson(path)) throw error;
    }
    return res.status(201).json({ id });
  } catch {
    return res.status(503).json({ error: 'Хранилище заявок временно недоступно.' });
  }
}
