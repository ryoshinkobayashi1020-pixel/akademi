'use client';
import { useState } from 'react';

function extractBody(html: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return m ? m[1] : html;
}
function extractStyle(html: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
  return m ? m[1] : '';
}

export default function DownloadButton() {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const [mainRes, m20Res, m21Res] = await Promise.all([
        fetch('/api/document'),
        fetch('/api/materials/20'),
        fetch('/api/materials/21'),
      ]);
      const [mainHtml, m20Html, m21Html] = await Promise.all([mainRes.text(), m20Res.text(), m21Res.text()]);
      const combined = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<base href="/document/">
<title>2026年度 白山青年会議所アカデミー事業計画（案）</title>
<style>
${extractStyle(m20Html)}
${extractStyle(m21Html)}
.materials-section { margin-top: 60px; padding-top: 24px; border-top: 4px double #174a38; }
</style>
</head>
<body>
${extractBody(mainHtml)}
<div class="materials-section">${extractBody(m20Html)}</div>
<div class="materials-section">${extractBody(m21Html)}</div>
</body>
</html>`;
      const blob = new Blob([combined], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gian.html';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }
  return <button className="pill" onClick={download} disabled={busy}>{busy ? 'ダウンロード中…' : 'HTMLをダウンロード'}</button>;
}
