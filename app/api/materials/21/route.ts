import { currentDocument, MATERIALS_21_DOC } from '../../../document-store';

export async function GET(request: Request) {
  const html = await currentDocument(request, MATERIALS_21_DOC);
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
