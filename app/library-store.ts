import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const BUCKET = 'library';

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// Supabase Storage's download() goes through a CDN that can briefly serve a
// stale copy right after an upsert overwrite. A cache-busting query string
// forces a fresh origin fetch every time.
async function downloadFresh(key: string): Promise<Buffer | null> {
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${key
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

// Supabase Storage object keys must be ASCII-safe — it rejects keys
// containing Japanese or other non-ASCII characters outright. Uploaded
// folders keep their original (often Japanese) relative paths as the
// document-facing identity — used for the entry file, hyperlink
// resolution and display — but every file is actually stored under a
// generated ASCII-safe key. `files` maps original relative path -> safe
// storage key ("files/<n>.<ext>").
export type LibraryMeta = {
  title: string;
  entryPath: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};
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

function safeExt(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
}

function pickEntryPath(paths: string[]) {
  const namedGian = paths.find((p) => /(^|\/)gian\.html?$/i.test(p));
  if (namedGian) return namedGian;
  const htmlPaths = paths.filter((p) => /\.html?$/i.test(p));
  htmlPaths.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return htmlPaths[0] || paths[0];
}

// Word/Excel "Web Page, Filtered" exports are frequently saved as
// Shift_JIS (declared via <meta charset=shift_jis>) rather than UTF-8.
// Reading those bytes as UTF-8 produces mojibake, so every uploaded
// HTML file is normalized to UTF-8 up front, rewriting its own charset
// declaration to match.
function normalizeHtmlEncoding(path: string, buffer: Buffer): Buffer {
  if (!/\.html?$/i.test(path)) return buffer;
  const head = buffer.subarray(0, 4096).toString('latin1');
  const declared = /charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  if (!declared || declared === 'utf-8' || declared === 'utf8' || declared === 'us-ascii' || declared === 'ascii') return buffer;
  let text: string;
  try {
    text = new TextDecoder(declared).decode(buffer);
  } catch {
    return buffer;
  }
  text = text.replace(/charset=["']?[\w-]+/i, 'charset=utf-8');
  return Buffer.from(text, 'utf-8');
}

// A pure function of the original path, so both creation (building the
// manifest) and per-file upload can compute the same safe key without any
// round trip to read existing state first — this matters when a folder
// has hundreds of files, since every extra round trip multiplies the
// total upload time.
function keyFor(path: string) {
  const hash = createHash('sha1').update(path).digest('hex').slice(0, 20);
  return `files/${hash}.${safeExt(path)}`;
}

export async function createLibraryDocument(title: string, paths: string[]) {
  const id = `lib_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const entryPath = pickEntryPath(paths);
  const files: Record<string, string> = {};
  for (const p of paths) files[p] = keyFor(p);
  const now = new Date().toISOString();
  const meta: LibraryMeta = { title, entryPath, files, createdAt: now, updatedAt: now };
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/_meta.json`, Buffer.from(JSON.stringify(meta)), { contentType: 'application/json', upsert: true });
  return { id, entryPath };
}

export async function uploadLibraryFile(id: string, path: string, buffer: Buffer) {
  const key = keyFor(path);
  const normalized = normalizeHtmlEncoding(path, buffer);
  const { error } = await client()
    .storage.from(BUCKET)
    .upload(`${id}/${key}`, normalized, { contentType: contentTypeFor(path), upsert: true });
  if (error) throw new Error(error.message);
}

async function writeMeta(id: string, meta: LibraryMeta) {
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/_meta.json`, Buffer.from(JSON.stringify(meta)), { contentType: 'application/json', upsert: true });
}

async function getMeta(id: string): Promise<LibraryMeta | null> {
  const buffer = await downloadFresh(`${id}/_meta.json`);
  if (!buffer) return null;
  try {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    if (!parsed.files) parsed.files = {};
    return parsed;
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
  const meta = await getMeta(id);
  const key = meta?.files[path];
  if (!key) return null;
  const buffer = await downloadFresh(`${id}/${key}`);
  if (!buffer) return null;
  return { buffer, contentType: contentTypeFor(path) };
}

// Resolves the entry file for a document, self-healing meta.entryPath by
// picking a different registered file if the recorded entry path is
// missing from the manifest (e.g. an older/corrupted upload).
export async function resolveLibraryEntry(id: string, meta: LibraryMeta) {
  const direct = await getLibraryFile(id, meta.entryPath);
  if (direct) return { file: direct, entryPath: meta.entryPath };
  const fallbackPath = pickEntryPath(Object.keys(meta.files));
  if (!fallbackPath || fallbackPath === meta.entryPath) return null;
  const file = await getLibraryFile(id, fallbackPath);
  if (!file) return null;
  await writeMeta(id, { ...meta, entryPath: fallbackPath });
  return { file, entryPath: fallbackPath };
}

export async function saveLibraryEntry(id: string, html: string) {
  const meta = await getMeta(id);
  if (!meta) throw new Error('not found');
  const key = meta.files[meta.entryPath] || keyFor(meta.entryPath);
  await client()
    .storage.from(BUCKET)
    .upload(`${id}/${key}`, Buffer.from(html), { contentType: 'text/html; charset=utf-8', upsert: true });
  const updated: LibraryMeta = { ...meta, files: { ...meta.files, [meta.entryPath]: key }, updatedAt: new Date().toISOString() };
  await writeMeta(id, updated);
}

export async function deleteLibraryDocument(id: string) {
  const meta = await getMeta(id);
  const keys = meta ? Object.values(meta.files).map((k) => `${id}/${k}`) : [];
  keys.push(`${id}/_meta.json`);
  await client().storage.from(BUCKET).remove(keys);
}
