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
  const [fileCount, setFileCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
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
    setError('');
    const input = fileInputRef.current;
    const files = input?.files ? Array.from(input.files) : [];
    if (!title.trim()) {
      setError('議案名を入力してください');
      return;
    }
    if (!files.length) {
      setError('フォルダが選択されていません。「ファイルを選択」からアップロードしたいフォルダを選んでください。');
      return;
    }
    if (busy) return;
    setBusy(true);
    const paths = files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    setProgress('登録中…');
    let created: { id?: string; error?: string };
    try {
      const createRes = await fetch('/api/library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), paths }),
      });
      created = (await createRes.json()) as { id?: string; error?: string };
    } catch {
      setProgress('');
      setError('通信エラーが発生しました。もう一度お試しください。');
      setBusy(false);
      return;
    }
    if (!created.id) {
      setProgress('');
      setError(created.error || '作成に失敗しました');
      setBusy(false);
      return;
    }
    const failed: string[] = [];
    let completed = 0;
    const libraryId = created.id;
    async function uploadOne(i: number) {
      const fd = new FormData();
      fd.append('path', paths[i]);
      fd.append('file', files[i]);
      const res = await fetch(`/api/library/${libraryId}/files`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
    }
    let nextIndex = 0;
    async function worker() {
      for (;;) {
        const i = nextIndex++;
        if (i >= files.length) return;
        try {
          await uploadOne(i);
        } catch {
          try {
            await uploadOne(i);
          } catch {
            failed.push(paths[i]);
          }
        }
        completed++;
        setProgress(`アップロード中…（${completed}/${files.length}）`);
      }
    }
    const concurrency = Math.min(6, files.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setProgress('');
    if (failed.length) {
      setError(`${failed.length}件のファイルをアップロードできませんでした（ファイルサイズが大きすぎる可能性があります）: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ' 他' : ''}`);
      setBusy(false);
      await load();
      return;
    }
    setTitle('');
    setFileCount(0);
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
          <input
            type="file"
            multiple
            ref={fileInputRefCallback}
            onChange={(e) => setFileCount(e.target.files?.length || 0)}
          />
          {fileCount > 0 && <p className="library-progress">{fileCount}件のファイルを選択中</p>}
          <button type="button" disabled={busy} onClick={upload}>
            {busy ? 'アップロード中…' : 'このフォルダをアップロード'}
          </button>
          {progress && <p className="library-progress">{progress}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
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
