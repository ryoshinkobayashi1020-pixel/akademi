import { cookies } from 'next/headers';

export type Role = 'viewer' | 'admin';
const encoder = new TextEncoder();
const secret = () => process.env.AUTH_SECRET || 'academy-local-development-secret';

async function digest(value: string) {
  const data = await crypto.subtle.digest('SHA-256', encoder.encode(`${value}:${secret()}`));
  return Array.from(new Uint8Array(data), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function makeSession(role: Role) { const payload = `${role}.${Date.now() + 86400000}`; return `${payload}.${await digest(payload)}`; }
export async function readRole(): Promise<Role | null> {
  const token = (await cookies()).get('academy_session')?.value; if (!token) return null;
  const [role, expires, signature] = token.split('.'); const payload = `${role}.${expires}`;
  if ((role !== 'viewer' && role !== 'admin') || Number(expires) < Date.now() || signature !== await digest(payload)) return null;
  return role;
}
