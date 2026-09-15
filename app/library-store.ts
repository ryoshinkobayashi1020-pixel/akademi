import { createClient } from '@supabase/supabase-js';

const BUCKET = 'library';

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// Supabase Storage's download() goes through a CDN that can briefly serve a
// stale copy right after an upsert overwrite. A cache-busting query string
// forces a fresh origin fetch every time.
async function downloadFresh(path: string): Promise<Buffer | null> {
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}?t=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export type LibraryMeta = { title: string; entryPath: string; createdAt: string; updatedAt: string };
export type LibraryItem = LibraryMeta & { id: string };

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css',
  js: 'application/javascript',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  doc: 'application/msword',
  thmx: 'application/octet-stream',
};

function contentTypeFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function pickEntryPath(paths: string[]) {
  const htmlPaths = paths.filter((p) => /\.html?$/i.test(p));
  htmlPaths.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return htmlPaths[0] || paths[0];
}

export async function createLibraryDocument(title: string, paths: string[]) {
  const id = `lib_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const entryPath = pickEntryPath(paths);
  const now = new Date().toISOString();
  const meta: LibraryMeta = { title, entryPath, createdAt: now, updatedAt: now };
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/_meta.json`, Buffer.from(JSON.stringify(meta)), { contentType: 'application/json', upsert: true });
  return { id, entryPath };
}

export async function uploadLibraryFile(id: string, path: string, buffer: Buffer) {
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/${path}`, buffer, { contentType: contentTypeFor(path), upsert: true });
}

async function getMeta(id: string): Promise<LibraryMeta | null> {
  const buffer = await downloadFresh(`${id}/_meta.json`);
  if (!buffer) return null;
  try {
    return JSON.parse(buffer.toString('utf-8'));
  } catch {
    return null;
  }
}

export async function getLibraryMeta(id: string) {
  return getMeta(id);
}

export async function listLibraryDocuments(): Promise<LibraryItem[]> {
  const { data } = await client().storage.from(BUCKET).list('', { limit: 200 });
  const folders = (data || []).filter((d) => d.id === null);
  const items = await Promise.all(
    folders.map(async (f) => {
      const meta = await getMeta(f.name);
      return meta ? { id: f.name, ...meta } : null;
    })
  );
  return items.filter((x): x is LibraryItem => !!x).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLibraryFile(id: string, path: string) {
  const buffer = await downloadFresh(`${id}/${path}`);
  if (!buffer) return null;
  return { buffer, contentType: contentTypeFor(path) };
}

export async function saveLibraryEntry(id: string, html: string) {
  const meta = await getMeta(id);
  if (!meta) throw new Error('not found');
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/${meta.entryPath}`, Buffer.from(html), { contentType: 'text/html; charset=utf-8', upsert: true });
  const updated: LibraryMeta = { ...meta, updatedAt: new Date().toISOString() };
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/_meta.json`, Buffer.from(JSON.stringify(updated)), { contentType: 'application/json', upsert: true });
}

async function listAllPaths(prefix: string): Promise<string[]> {
  const { data } = await client().storage.from(BUCKET).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const entry of data || []) {
    const full = `${prefix}/${entry.name}`;
    if (entry.id === null) out.push(...(await listAllPaths(full)));
    else out.push(full);
  }
  return out;
}

export async function deleteLibraryDocument(id: string) {
  const paths = await listAllPaths(id);
  if (paths.length) await client().storage.from(BUCKET).remove(paths);
}
