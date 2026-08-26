import { readRole } from '../../auth';
import { listRevisions, restoreRevision } from '../../document-store';

export async function GET() {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const revisions = await listRevisions();
  return Response.json({ revisions });
}

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { id } = (await request.json()) as { id?: number };
  if (!id) return Response.json({ error: '版を指定してください' }, { status: 400 });
  await restoreRevision(id);
  return Response.json({ ok: true });
}
