import { readRole } from '../../../auth';
import { currentDocument, MATERIALS_20_DOC, MATERIALS_21_DOC } from '../../../document-store';
import { parseMaterials } from '../../../materials-data';
import { refreshMaterialText, isDriveUrl } from '../../../material-text';

export const maxDuration = 60;

export async function POST(request: Request) {
  if ((await readRole()) !== 'admin') return Response.json({ error: '管理者のみ利用できます' }, { status: 403 });
  const { target } = (await request.json()) as { target?: string };
  const docId = target === '21' ? MATERIALS_21_DOC : MATERIALS_20_DOC;
  const html = await currentDocument(request, docId);
  const items = parseMaterials(html).filter((m) => isDriveUrl(m.url));
  const results = await Promise.all(items.map((m) => refreshMaterialText(m.url)));
  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.map((r, i) => ({ label: items[i].label, status: r.status })).filter((r) => r.status !== 'ok');
  return Response.json({ total: items.length, ok, failed });
}
