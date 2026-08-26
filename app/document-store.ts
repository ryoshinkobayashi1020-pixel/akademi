import { createClient } from '@supabase/supabase-js';

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function currentDocument(request: Request) {
  const { data } = await client().from('documents').select('html').eq('id', 1).maybeSingle();
  if (data?.html) return data.html as string;
  const origin = new URL(request.url).origin;
  return fetch(`${origin}/document/gian.html`).then((r) => r.text());
}

export async function saveDocument(html: string, summary: string) {
  const supabase = client();
  const now = new Date().toISOString();
  await supabase.from('revisions').insert({ html, summary, created_at: now });
  await supabase.from('documents').upsert({ id: 1, html, updated_at: now });
}
