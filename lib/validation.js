import { locations, stages } from '../public/fields.js';

const lengths = {
  name: 100, sector: 100, team: 350, description: 1200, audience: 400,
  geo: 350, stage: 120, role: 100, city: 60, stageKey: 20, url: 350,
  founderLinkedIn: 350, companyLinkedIn: 350, contactUrl: 350,
  contactEmail: 150,
};
const required = ['name', 'sector', 'team', 'description', 'audience', 'geo'];

export function webUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function linkedIn(value, kind) {
  if (!webUrl(value)) return false;
  const url = new URL(value);
  return /(^|\.)linkedin\.com$/i.test(url.hostname) &&
    url.pathname.startsWith('/' + kind + '/') && !!url.pathname.split('/')[2];
}

export function validateEntry(body, { submission = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const entry = {};
  for (const [key, max] of Object.entries(lengths)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > max) return null;
    entry[key] = value.trim();
  }
  if (required.some(key => !entry[key])) return null;
  if (entry.city && !Object.hasOwn(locations, entry.city)) return null;
  if (entry.stageKey && !Object.hasOwn(stages, entry.stageKey)) return null;
  if (submission && (!entry.url || !entry.stageKey || body.publicContacts !== true)) return null;
  if ((entry.url && !webUrl(entry.url)) || (entry.contactUrl && !webUrl(entry.contactUrl))) return null;
  if (entry.founderLinkedIn && !linkedIn(entry.founderLinkedIn, 'in')) return null;
  if (entry.companyLinkedIn && !linkedIn(entry.companyLinkedIn, 'company')) return null;
  if (entry.contactEmail && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(entry.contactEmail)) return null;
  return entry;
}

export function sameOrigin(req) {
  if (!req.headers.origin) return false;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function isJson(req) {
  return req.headers['content-type']?.split(';')[0] === 'application/json';
}
