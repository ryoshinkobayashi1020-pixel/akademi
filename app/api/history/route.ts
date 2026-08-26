import { readRole } from '../../auth';
import { listRevisions, restoreRevision, MAIN_DOC, MATERIALS_DOC } from '../../document-store';

export async function GET(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const target = new URL(request.url).searchParams.get('target');
  const revisions = await listRevisions(target === 'materials' ? MATERIALS_DOC : MAIN_DOC);
  return Response.json({ revisions });
}

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { id } = (await request.json()) as { id?: number };
  if (!id) return Response.json({ error: '版を指定してください' }, { status: 400 });
  await restoreRevision(id);
  return Response.json({ ok: true });
}
