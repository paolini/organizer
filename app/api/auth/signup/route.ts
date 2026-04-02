import { NextResponse } from 'next/server';
import { readUsers, writeUsers, hashPassword } from '../../../../lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;
    if (!username || !password) return NextResponse.json({ error: 'username and password required' }, { status: 400 });
    const users = await readUsers();
    if (users.find((u: any) => u.username === username)) {
      return NextResponse.json({ error: 'User exists' }, { status: 409 });
    }
    const pwHash = await hashPassword(password);
    const user = { id: Date.now(), username, password: pwHash };
    users.push(user);
    await writeUsers(users);
    return NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
