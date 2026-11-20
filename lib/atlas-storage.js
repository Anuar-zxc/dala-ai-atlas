import { get, put, list } from '@vercel/blob';

const statePath = 'editorial/catalog-v1.json';

export async function readJson(path) {
  const blob = await get(path, { access: 'private', useCache: false });
  if (!blob) return null;
  return { value: await new Response(blob.stream).json(), etag: blob.blob.etag };
}

export function writeJson(path, value, options = {}) {
  return put(path, JSON.stringify(value), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    ...options,
  });
}

export async function editorialState() {
  const current = await readJson(statePath);
  return current || { value: { changes: {}, reviews: {} }, etag: null };
}

export function saveEditorial(value, etag) {
  return writeJson(statePath, value, etag ? { ifMatch: etag } : {});
}

export async function readSubmissions(cursor) {
  const page = await list({ prefix: 'pending/', limit: 30, cursor });
  const rows = await Promise.all(page.blobs.map(async blob => {
    const id = blob.pathname.match(/^pending\/([a-f0-9]{64})\.json$/)?.[1];
    if (!id) return null;
    const record = await readJson(blob.pathname);
    return record ? { id, entry: record.value, receivedAt: blob.uploadedAt } : null;
  }));
  return { submissions: rows.filter(Boolean), next: page.cursor || null };
}
