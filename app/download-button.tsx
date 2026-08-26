'use client';
import { useState } from 'react';

export default function DownloadButton() {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await fetch('/api/document');
      let html = await res.text();
      // Make the 20/21 materials links absolute so they still work (via the live site) once downloaded.
      html = html
        .replaceAll('href="/api/materials/20"', `href="${origin}/api/materials/20"`)
        .replaceAll('href="/api/materials/21"', `href="${origin}/api/materials/21"`);
      const blob = new Blob([html], { type: 'text/html' });
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
