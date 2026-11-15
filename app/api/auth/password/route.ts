import { NextResponse } from 'next/server';
import {
  getUserFromReq, updateUsers, hashPassword, verifyPassword,
  passwordProblem, sessionCookie,
} from '../../_lib/auth';

// Cambio della propria password. Body: { currentPassword, newPassword }
export async function POST(req: Request) {
  const me = await getUserFromReq(req);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { currentPassword, newPassword } = body ?? {};
  if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, me.password))) {
    return NextResponse.json({ error: 'La password attuale non è corretta' }, { status: 400 });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const pwHash = await hashPassword(newPassword);
  await updateUsers(users => {
    const u = users.find(x => x.id === me.id);
    if (!u) throw new Error('Utente non trovato');
    u.password = pwHash;
    u.passwordChangedAt = Date.now();
  });
  // Le altre sessioni vengono invalidate; questa riceve un token nuovo.
  return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': sessionCookie(me.username) } });
}
