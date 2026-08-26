import { redirect } from 'next/navigation'; import { readRole } from '../auth'; import AdminEditor from './admin-editor';
export const dynamic='force-dynamic';
export default async function Admin(){ if(await readRole()!=='admin') redirect('/'); return <AdminEditor/>; }
