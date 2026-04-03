import { NextResponse } from 'next/server';
import { readUsers, verifyPassword, signToken } from '../../_lib/auth';
import { serialize } from 'cookie';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;
    if (!username || !password) return NextResponse.json({ error: 'username and password required' }, { status: 400 });
    const users = await readUsers();
    const user = users.find((u: any) => u.username === username);
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const ok = await verifyPassword(password, user.password);
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const token = signToken({ username });
    const cookie = serialize('token', token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    return NextResponse.json({ success: true, user: { id: user.id, username: user.username } }, { headers: { 'Set-Cookie': cookie } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
