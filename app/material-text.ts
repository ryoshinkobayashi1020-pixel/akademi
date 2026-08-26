import { createClient } from '@supabase/supabase-js';

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function driveFileId(url: string): string | null {
  const m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(url) || /[?&]id=([\w-]+)/.exec(url);
  return m ? m[1] : null;
}

export function isDriveUrl(url: string): boolean {
  return driveFileId(url) !== null;
}

async function fetchAndExtract(url: string): Promise<{ content: string | null; status: string }> {
  const fileId = driveFileId(url);
  if (!fileId) return { content: null, status: 'unsupported-url' };
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  let res: Response;
  try {
    res = await fetch(downloadUrl, { redirect: 'follow' });
  } catch {
    return { content: null, status: 'fetch-failed' };
  }
  if (!res.ok) return { content: null, status: `http-${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    const asText = buf.subarray(0, 200).toString('utf8');
    if (asText.includes('<html') || asText.includes('Google Drive')) return { content: null, status: 'not-public-or-confirm-page' };
    return { content: null, status: 'not-pdf' };
  }
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buf });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = parsed.text.replace(/\s+/g, ' ').trim();
    return { content: text.slice(0, 8000), status: 'ok' };
  } catch {
    return { content: null, status: 'parse-failed' };
  }
}

/** Fetches+extracts (live), caching the result. Slow — use only from a dedicated analyze action, not per edit request. */
export async function refreshMaterialText(url: string): Promise<{ content: string | null; status: string }> {
  const supabase = client();
  const result = await fetchAndExtract(url);
  await supabase.from('material_texts').upsert({ url, content: result.content, status: result.status, fetched_at: new Date().toISOString() });
  return result;
}

/** Reads only what's already cached — fast, no network fetch. Safe to call from request-time paths. */
export async function peekMaterialTexts(urls: string[]): Promise<Map<string, string>> {
  if (!urls.length) return new Map();
  const supabase = client();
  const { data } = await supabase.from('material_texts').select('url, content').in('url', urls);
  const results = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.content) results.set(row.url, row.content as string);
  }
  return results;
}
