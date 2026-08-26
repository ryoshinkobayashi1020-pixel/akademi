'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    const response = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    const result = await response.json() as { role?: 'viewer' | 'admin'; error?: string };
    setLoading(false);
    if (!response.ok || !result.role) { setError(result.error || 'パスワードを確認してください'); return; }
    router.push(result.role === 'admin' ? '/admin' : '/viewer');
  }

  return <main className="login-page"><section className="login-card">
    <img className="login-wordmark" src="/assets/academy-wordmark-v2.png" alt="アカデミー" />
    <form className="login-form" onSubmit={login}><input aria-label="パスワード" id="password" type="password" inputMode="numeric" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" autoFocus />{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" disabled={loading || !password}>{loading ? '確認中…' : 'ログイン'}</button></form>
  </section></main>;
}
