'use client';
import { useRouter } from 'next/navigation';
export default function LogoutButton(){ const router=useRouter(); return <button className="ghost" onClick={async()=>{await fetch('/api/logout',{method:'POST'});router.push('/');}}>ログアウト</button>; }
