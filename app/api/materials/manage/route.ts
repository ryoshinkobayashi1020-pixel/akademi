import { readRole } from '../../../auth';
import { currentDocument, saveDocument, MATERIALS_DOC } from '../../../document-store';
import { parseMaterials, addMaterial, removeMaterial } from '../../../materials-data';

export async function GET(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const html = await currentDocument(request, MATERIALS_DOC);
  return Response.json({ items: parseMaterials(html) });
}

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { section, label, url } = (await request.json()) as { section?: string; label?: string; url?: string };
  if (!section?.trim() || !label?.trim() || !url?.trim()) return Response.json({ error: '区分・タイトル・URLを入力してください' }, { status: 400 });
  const html = await currentDocument(request, MATERIALS_DOC);
  const updated = addMaterial(html, { section: section.trim(), label: label.trim(), url: url.trim() });
  await saveDocument(updated, `資料「${label.trim()}」を追加しました`, MATERIALS_DOC);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { label, url } = (await request.json()) as { label?: string; url?: string };
  if (!label || !url) return Response.json({ error: '削除対象を指定してください' }, { status: 400 });
  const html = await currentDocument(request, MATERIALS_DOC);
  const updated = removeMaterial(html, url, label);
  await saveDocument(updated, `資料「${label}」を削除しました`, MATERIALS_DOC);
  return Response.json({ ok: true });
}
