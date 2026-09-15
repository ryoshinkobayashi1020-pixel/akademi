import { readRole } from '../../../auth';
import { getLibraryMeta, getLibraryFile, deleteLibraryDocument } from '../../../library-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await readRole())) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const meta = await getLibraryMeta(id);
  if (!meta) return new Response('Not found', { status: 404 });
  const file = await getLibraryFile(id, meta.entryPath);
  if (!file) return new Response('Not found', { status: 404 });
  const raw = file.buffer.toString('utf-8');
  const base = `<base href="/api/library/${id}/files/">`;
  const html = /<head[^>]*>/i.test(raw) ? raw.replace(/(<head[^>]*>)/i, `$1${base}`) : `<head>${base}</head>${raw}`;
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self' 'unsafe-inline' data:; frame-ancestors 'self'",
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { id } = await params;
  await deleteLibraryDocument(id);
  return Response.json({ ok: true });
}
