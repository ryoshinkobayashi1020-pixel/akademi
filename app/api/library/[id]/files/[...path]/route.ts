import { readRole } from '../../../../../auth';
import { getLibraryFile } from '../../../../../library-store';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  if (!(await readRole())) return new Response('Unauthorized', { status: 401 });
  const { id, path } = await params;
  const file = await getLibraryFile(id, path.join('/'));
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(file.buffer), { headers: { 'content-type': file.contentType, 'cache-control': 'no-store' } });
}
