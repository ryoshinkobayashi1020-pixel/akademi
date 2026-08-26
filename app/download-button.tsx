'use client';
import { useState } from 'react';

export default function DownloadButton() {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const res = await fetch('/api/document');
      const blob = await res.blob();
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
