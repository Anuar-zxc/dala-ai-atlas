import { editorialState } from '../lib/atlas-storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.setHeader('Allow', 'GET').status(405).end();
  try {
    const { value } = await editorialState();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=15');
    const visible = Object.fromEntries(Object.entries(value.changes).map(([id, change]) =>
      [id, change.hidden ? { hidden: true } : change]));
    return res.json(visible);
  } catch {
    return res.status(503).json({ error: 'Обновления каталога временно недоступны.' });
  }
}
