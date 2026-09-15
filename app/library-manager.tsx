'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { id: string; title: string; entryPath: string; updatedAt: string };
type PickerInput = HTMLInputElement & { webkitdirectory?: boolean };

export default function LibraryManager({
  activeId,
  onOpen,
  onClosed,
}: {
  activeId: string | null;
  onOpen: (id: string) => void;
  onClosed: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<PickerInput | null>(null);
  const fileInputRefCallback = useCallback((el: PickerInput | null) => {
    fileInputRef.current = el;
    if (el) {
      el.setAttribute('webkitdirectory', 'true');
      el.setAttribute('directory', 'true');
    }
  }, []);

  async function load() {
    const res = await fetch('/api/library');
    const data = (await res.json()) as { items?: Item[] };
    setItems(data.items || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload() {
    const input = fileInputRef.current;
    const files = input?.files ? Array.from(input.files) : [];
    if (!title.trim() || !files.length || busy) return;
    setBusy(true);
    const paths = files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    setProgress('登録中…');
    const createRes = await fetch('/api/library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), paths }),
    });
    const created = (await createRes.json()) as { id?: string; error?: string };
    if (!created.id) {
      setProgress(created.error || '作成に失敗しました');
      setBusy(false);
      return;
    }
    for (let i = 0; i < files.length; i++) {
      setProgress(`アップロード中…（${i + 1}/${files.length}）`);
      const fd = new FormData();
      fd.append('path', paths[i]);
      fd.append('file', files[i]);
      await fetch(`/api/library/${created.id}/files`, { method: 'POST', body: fd });
    }
    setProgress('');
    setTitle('');
    if (input) input.value = '';
    await load();
    setAdding(false);
    setBusy(false);
    onOpen(created.id);
  }

  async function remove(item: Item) {
    if (busy) return;
    if (!confirm(`「${item.title}」を削除しますか？`)) return;
    setBusy(true);
    await fetch(`/api/library/${item.id}`, { method: 'DELETE' });
    if (activeId === item.id) onClosed();
    await load();
    setBusy(false);
  }

  return (
    <div className="library-manager">
      <div className="library-head">
        <h2>登録済みの議案</h2>
        <button type="button" className="pill" onClick={() => setAdding((v) => !v)}>
          {adding ? '閉じる' : '議案を追加'}
        </button>
      </div>
      {adding && (
        <div className="library-add">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="議案名" />
          <input type="file" multiple ref={fileInputRefCallback} />
          <button type="button" disabled={busy || !title.trim()} onClick={upload}>
            {busy ? 'アップロード中…' : 'このフォルダをアップロード'}
          </button>
          {progress && <p className="library-progress">{progress}</p>}
        </div>
      )}
      <div className="library-list">
        {items.length === 0 && <p className="history-empty">まだ議案がありません</p>}
        {items.map((it) => (
          <div key={it.id} className={`library-row${activeId === it.id ? ' active' : ''}`}>
            <button type="button" className="library-open" onClick={() => onOpen(it.id)}>
              {it.title}
            </button>
            <button type="button" className="library-delete" disabled={busy} onClick={() => remove(it)}>
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
