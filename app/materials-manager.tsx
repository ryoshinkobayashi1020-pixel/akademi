'use client';
import { FormEvent, useEffect, useState } from 'react';

type Item = { section: string; label: string; url: string };

export default function MaterialsManager({ target, label: buttonLabel, onChanged }: { target: '20' | '21'; label: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [section, setSection] = useState('');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/materials/manage?target=${target}`);
    const data = (await res.json()) as { items?: Item[] };
    setItems(data.items || []);
  }

  useEffect(() => {
    if (open) load();
  }, [open, target]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!section.trim() || !label.trim() || !url.trim() || busy) return;
    setBusy(true);
    await fetch('/api/materials/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ section, label, url, target }) });
    setLabel('');
    setUrl('');
    await load();
    onChanged();
    setBusy(false);
  }

  async function remove(item: Item) {
    if (busy) return;
    if (!confirm(`「${item.label}」を削除しますか？`)) return;
    setBusy(true);
    await fetch('/api/materials/manage', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: item.label, url: item.url, target }) });
    await load();
    onChanged();
    setBusy(false);
  }

  return (
    <div className="materials-manager">
      <button className="pill" onClick={() => setOpen((v) => !v)}>{buttonLabel}</button>
      {open && (
        <div className="materials-dropdown">
          <form className="materials-add-form" onSubmit={add}>
            <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="区分（例：参考資料）" list="materials-sections" />
            <datalist id="materials-sections">
              {[...new Set(items.map((i) => i.section))].map((s) => <option key={s} value={s} />)}
            </datalist>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="タイトル" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" />
            <button disabled={busy || !section.trim() || !label.trim() || !url.trim()}>追加</button>
          </form>
          <div className="materials-list">
            {items.length === 0 && <p className="history-empty">資料はまだありません</p>}
            {items.map((it, i) => (
              <div key={i} className="materials-row">
                <span className="materials-section">{it.section}</span>
                <a href={it.url} target="_blank" rel="noreferrer">{it.label}</a>
                <button disabled={busy} onClick={() => remove(it)}>削除</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
