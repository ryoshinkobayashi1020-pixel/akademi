'use client';
import { useEffect, useState } from 'react';

type Revision = { id: number; summary: string; created_at: string };

export default function HistoryPanel({ target, onRestored }: { target: 'main' | 'materials'; onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const res = await fetch(`/api/history?target=${target}`);
    const data = (await res.json()) as { revisions?: Revision[] };
    setRevisions(data.revisions || []);
  }

  useEffect(() => {
    if (open) load();
  }, [open, target]);

  async function restore(id: number) {
    if (busyId) return;
    if (!confirm('この版に戻します。よろしいですか？')) return;
    setBusyId(id);
    await fetch('/api/history', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    setBusyId(null);
    setOpen(false);
    onRestored();
  }

  return (
    <div className="history-panel">
      <button className="pill" onClick={() => setOpen((v) => !v)}>編集履歴</button>
      {open && (
        <div className="history-dropdown">
          {revisions.length === 0 && <p className="history-empty">履歴はまだありません</p>}
          {revisions.map((r) => (
            <div key={r.id} className="history-row">
              <div className="history-meta">
                <span className="history-date">{new Date(r.created_at).toLocaleString('ja-JP')}</span>
                <span className="history-summary">{r.summary}</span>
              </div>
              <button disabled={busyId === r.id} onClick={() => restore(r.id)}>
                {busyId === r.id ? '復元中…' : 'この内容に戻す'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
