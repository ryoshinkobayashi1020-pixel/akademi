import { readRole } from '../../auth';
import { listRevisions, restoreRevision, MAIN_DOC, MATERIALS_20_DOC, MATERIALS_21_DOC } from '../../document-store';

function docIdFor(target: string | null) {
  if (target === 'materials20') return MATERIALS_20_DOC;
  if (target === 'materials21') return MATERIALS_21_DOC;
  return MAIN_DOC;
}

export async function GET(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const target = new URL(request.url).searchParams.get('target');
  const revisions = await listRevisions(docIdFor(target));
  return Response.json({ revisions });
}

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { id } = (await request.json()) as { id?: number };
  if (!id) return Response.json({ error: '版を指定してください' }, { status: 400 });
  await restoreRevision(id);
  return Response.json({ ok: true });
}
