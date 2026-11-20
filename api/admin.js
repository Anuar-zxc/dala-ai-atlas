import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { BlobPreconditionFailedError } from '@vercel/blob';
import baseline from '../public/startups.json' with { type: 'json' };
import { editorialState, readJson, readSubmissions, saveEditorial } from '../lib/atlas-storage.js';
import { isJson, sameOrigin, validateEntry, webUrl } from '../lib/validation.js';
import { stages } from '../public/fields.js';

const cookie = '__Host-dala-editor';
const sessionSeconds = 8 * 60 * 60;
const seed = new Map(baseline.map(project => [project.id, project]));

function equal(a, b) {
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function sign(value, password) {
  return createHmac('sha256', password).update('dala-editor:' + value).digest('base64url');
}

function sessionCookie(res, value, age) {
  res.setHeader('Set-Cookie', cookie + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + age);
}

function authenticated(req, password) {
  const value = req.headers.cookie?.split(';').map(item => item.trim())
    .find(item => item.startsWith(cookie + '='))?.slice(cookie.length + 1);
  const [expiry, signature] = value?.split('.') || [];
  return /^\d{13}$/.test(expiry) && !!signature && Number(expiry) > Date.now() &&
    equal(signature, sign(expiry, password));
}

function parseContacts(raw) {
  if (typeof raw !== 'string' || raw.length > 4000) return null;
  const contacts = [];
  for (const line of raw.split('\n').map(line => line.trim()).filter(Boolean)) {
    const [label, url, extra] = line.split('|').map(value => value.trim());
    if (!label || label.length > 80 || !url || url.length > 350 || extra !== undefined) return null;
    if (!webUrl(url) && !/^mailto:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(url)) return null;
    contacts.push({ label, url });
  }
  return contacts.length <= 12 ? contacts : null;
}

async function changeCatalog(body, state) {
  const { action, id, submissionId } = body;
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,85}$/.test(id)) return false;
  const prior = Object.hasOwn(state.changes, id) ? state.changes[id] : null;
  const previous = prior?.project || seed.get(id);
  if (submissionId !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(submissionId) || id !== 'submission-' + submissionId) return false;
    if (!await readJson('pending/' + submissionId + '.json')) return false;
    if (action === 'reject' || action === 'reopen') {
      if (previous) state.changes[id] = { hidden: true, project: previous };
      if (action === 'reject') state.reviews[submissionId] = 'rejected';
      else delete state.reviews[submissionId];
      return true;
    }
  }
  if (action === 'hide' && previous && submissionId === undefined) {
    state.changes[id] = { hidden: true, project: previous };
    return true;
  }
  if (action !== 'publish' || (!previous && submissionId === undefined && !id.startsWith('editor-'))) return false;
  const entry = validateEntry(body.entry);
  const contacts = parseContacts(body.contacts);
  if (!entry || !contacts || !(entry.stage || entry.stageKey)) return false;
  const links = { ...previous?.links };
  if (entry.url) links['Публичный источник'] = entry.url;
  else delete links['Публичный источник'];
  if (!Object.keys(links).length) return false;
  const { name, sector, team, description, audience, geo, city, stageKey, stage, role } = entry;
  const project = {
    ...previous, id, name, sector, team, description, audience, geo, city, stageKey,
    stage: stage || stages[stageKey], role: role || 'Команда', links, contacts,
    checked: new Date().toISOString().slice(0, 10), kind: previous?.kind || 'company',
    logo: previous?.logo || null,
  };
  state.changes[id] = { project, hidden: false };
  if (submissionId !== undefined) state.reviews[submissionId] = 'published';
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const password = process.env.DALA_ADMIN_PASSWORD;
  if (!password || password.length < 32) return res.status(503).json({ error: 'Вход не настроен.' });
  if (!['GET', 'POST'].includes(req.method)) return res.setHeader('Allow', 'GET, POST').status(405).end();
  if (req.method === 'POST' && (!sameOrigin(req) || !isJson(req))) return res.status(403).end();
  if (Number(req.headers['content-length']) > 20000) return res.status(413).end();
  const body = req.body;
  if (req.method === 'POST' && body?.action === 'login') {
    if (typeof body.password !== 'string' || body.password.length > 256 || !equal(body.password, password)) {
      return res.status(401).json({ error: 'Неверный пароль.' });
    }
    const expiry = String(Date.now() + sessionSeconds * 1000);
    sessionCookie(res, expiry + '.' + sign(expiry, password), sessionSeconds);
    return res.json({ ok: true });
  }
  if (!authenticated(req, password)) return res.status(401).json({ error: 'Войдите в редакцию.' });
  if (req.method === 'POST' && body?.action === 'logout') {
    sessionCookie(res, '', 0);
    return res.json({ ok: true });
  }
  try {
    if (req.method === 'GET') {
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const [{ value, etag }, inbox] = await Promise.all([editorialState(), readSubmissions(cursor)]);
      return res.json({ ...inbox, ...value, revision: etag });
    }
    if (!body || typeof body !== 'object') return res.status(400).end();
    const { value, etag } = await editorialState();
    if (body.revision !== etag) return res.status(409).json({ error: 'Каталог изменился. Обновите редакцию перед сохранением.' });
    if (!await changeCatalog(body, value)) return res.status(400).json({ error: 'Проверьте поля, источник и формат контактов.' });
    try {
      await saveEditorial(value, etag);
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || (!etag && (await editorialState()).etag)) {
        return res.status(409).json({ error: 'Каталог изменился. Обновите редакцию перед сохранением.' });
      }
      throw error;
    }
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'Хранилище временно недоступно.' });
  }
}
