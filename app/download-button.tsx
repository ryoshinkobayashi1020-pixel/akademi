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
function scopeCss(css: string, scope: string): string {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (_all, selectors: string, body: string) => {
    const scoped = selectors
      .split(',')
      .map((s) => {
        const sel = s.trim();
        return sel === 'body' ? scope : `${scope} ${sel}`;
      })
      .join(', ');
    return `${scoped}{${body}}`;
  });
}

export default function DownloadButton() {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const [mainRes, m20Res, m21Res] = await Promise.all([
        fetch('/api/document'),
        fetch('/api/materials/20'),
        fetch('/api/materials/21'),
      ]);
      const [mainHtml, m20Html, m21Html] = await Promise.all([mainRes.text(), m20Res.text(), m21Res.text()]);
      // Make links/paths absolute so the downloaded file still works when opened offline of the server (via the live site).
      const mainBody = extractBody(mainHtml)
        .replaceAll('href="/api/materials/20"', `href="${origin}/api/materials/20"`)
        .replaceAll('href="/api/materials/21"', `href="${origin}/api/materials/21"`);
      const combined = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<base href="${origin}/document/">
<title>2026年度 白山青年会議所アカデミー事業計画（案）</title>
<style>
${scopeCss(extractStyle(m20Html), '.materials-section')}
${scopeCss(extractStyle(m21Html), '.materials-section')}
.materials-section { margin-top: 60px; padding-top: 24px; border-top: 4px double #174a38; }
</style>
</head>
<body>
${mainBody}
<div class="materials-section" id="materials-20">${extractBody(m20Html)}</div>
<div class="materials-section" id="materials-21">${extractBody(m21Html)}</div>
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
