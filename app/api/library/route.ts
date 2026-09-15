import { readRole } from '../../auth';
import { createLibraryDocument, listLibraryDocuments } from '../../library-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  if (!(await readRole())) return Response.json({ error: '未ログインです' }, { status: 401 });
  return Response.json({ items: await listLibraryDocuments() });
}

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { title, paths } = (await request.json()) as { title?: string; paths?: string[] };
  if (!title?.trim() || !paths?.length) return Response.json({ error: 'タイトルとフォルダを指定してください' }, { status: 400 });
  const { id, entryPath } = await createLibraryDocument(title.trim(), paths);
  return Response.json({ ok: true, id, entryPath });
}
