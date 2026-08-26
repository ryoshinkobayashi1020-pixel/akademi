import { NextResponse } from 'next/server';
import { makeSession, Role } from '../../auth';
export async function POST(request: Request) {
  const { password } = await request.json() as { password?: string };
  const role: Role | null = password === (process.env.ADMIN_PASSWORD || '0623') ? 'admin' : password === (process.env.VIEWER_PASSWORD || '1020') ? 'viewer' : null;
  if (!role) return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
  const response = NextResponse.json({ role });
  response.cookies.set('academy_session', await makeSession(role), { httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'lax', path:'/', maxAge:86400 });
  return response;
}
