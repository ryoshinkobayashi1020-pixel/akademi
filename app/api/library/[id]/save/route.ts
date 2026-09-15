import { readRole } from '../../../../auth';
import { saveLibraryEntry } from '../../../../library-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { id } = await params;
  const { html } = (await request.json()) as { html?: string };
  if (!html?.trim()) return Response.json({ error: '内容が空です' }, { status: 400 });
  await saveLibraryEntry(id, html);
  return Response.json({ ok: true });
}
