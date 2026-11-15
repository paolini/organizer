import { NextResponse } from 'next/server';
import {
  authorize, readUsers, updateUsers, hashPassword, publicUser,
  isValidUsername, isValidPermissionList, passwordProblem, type User,
} from '../_lib/auth';

// Elenco utenti (solo admin)
export async function GET(req: Request) {
  const me = await authorize(req, 'admin');
  if (me instanceof NextResponse) return me;
  const users = await readUsers();
  return NextResponse.json({ users: users.map(publicUser), me: me.id });
}

// Crea un utente (solo admin). Body: { username, password, permissions }
export async function POST(req: Request) {
  const me = await authorize(req, 'admin');
  if (me instanceof NextResponse) return me;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { username, password, permissions = [] } = body ?? {};
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Nome utente non valido (2-32 caratteri: lettere, numeri, . _ -)' }, { status: 400 });
  }
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (!isValidPermissionList(permissions)) {
    return NextResponse.json({ error: 'Permessi non validi' }, { status: 400 });
  }

  const pwHash = await hashPassword(password);
  try {
    const user = await updateUsers(users => {
      if (users.some(u => u.username === username)) {
        throw Object.assign(new Error('Nome utente già in uso'), { status: 409 });
      }
      const u: User = { id: Date.now(), username, password: pwHash, permissions: [...new Set(permissions)] };
      users.push(u);
      return u;
    });
    console.log(`[users] ${me.username} ha creato ${user.username} [${user.permissions.join(',')}]`);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 500 });
  }
}
