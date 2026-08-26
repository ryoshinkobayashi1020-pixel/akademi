import { createClient } from '@supabase/supabase-js';

export const MAIN_DOC = 1;
export const MATERIALS_DOC = 2;

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function currentDocument(request: Request, docId = MAIN_DOC) {
  const { data } = await client().from('documents').select('html').eq('id', docId).maybeSingle();
  if (data?.html) return data.html as string;
  const origin = new URL(request.url).origin;
  return fetch(`${origin}/document/gian.html`).then((r) => r.text());
}

export async function saveDocument(html: string, summary: string, docId = MAIN_DOC) {
  const supabase = client();
  const now = new Date().toISOString();
  await supabase.from('revisions').insert({ html, summary, created_at: now, doc_id: docId });
  await supabase.from('documents').upsert({ id: docId, html, updated_at: now });
}

export async function listRevisions(docId = MAIN_DOC) {
  const { data } = await client()
    .from('revisions')
    .select('id, summary, created_at')
    .eq('doc_id', docId)
    .order('id', { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function restoreRevision(id: number) {
  const { data } = await client().from('revisions').select('html, doc_id').eq('id', id).maybeSingle();
  if (!data?.html) throw new Error('revision not found');
  await saveDocument(data.html as string, `以前の版（#${id}）に戻しました`, data.doc_id as number);
}
