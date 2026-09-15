import { readRole } from '../../../../auth';
import { uploadLibraryFile } from '../../../../library-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  const path = String(form.get('path') || '');
  const file = form.get('file') as File | null;
  if (!path || !file) return Response.json({ error: 'ファイルが指定されていません' }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await uploadLibraryFile(id, path, buffer);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'アップロードに失敗しました' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
