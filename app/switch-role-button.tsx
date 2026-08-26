'use client';
import { useRouter } from 'next/navigation';
export default function SwitchRoleButton({ label }: { label: string }) {
  const router = useRouter();
  return <button className="pill" onClick={async () => { await fetch('/api/logout', { method: 'POST' }); router.push('/'); }}>{label}</button>;
}
