import { readRole } from '../../auth';
import { saveDocument, MAIN_DOC, MATERIALS_20_DOC, MATERIALS_21_DOC } from '../../document-store';

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { html, target } = (await request.json()) as { html?: string; target?: 'main' | 'materials20' | 'materials21' };
  if (!html?.trim()) return Response.json({ error: '内容が空です' }, { status: 400 });
  const docId = target === 'materials21' ? MATERIALS_21_DOC : target === 'materials20' ? MATERIALS_20_DOC : MAIN_DOC;
  await saveDocument(html, '手動編集で保存しました', docId);
  return Response.json({ ok: true });
}
