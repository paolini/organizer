import { NextResponse } from 'next/server';
import {
  authorize, updateUsers, hashPassword, publicUser,
  isValidPermissionList, passwordProblem,
} from '../../_lib/auth';

type Ctx = { params: Promise<{ id: string }> };

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function fail(e: unknown) {
  return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 500 });
}

// Modifica permessi e/o reimposta la password (solo admin). Body: { permissions?, password? }
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await authorize(req, 'admin');
  if (me instanceof NextResponse) return me;
  const id = Number((await params).id);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { permissions, password } = body ?? {};
  if (permissions !== undefined && !isValidPermissionList(permissions)) {
    return NextResponse.json({ error: 'Permessi non validi' }, { status: 400 });
  }
  if (password !== undefined) {
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  const pwHash = password !== undefined ? await hashPassword(password) : null;

  try {
    const user = await updateUsers(users => {
      const u = users.find(x => x.id === id);
      if (!u) throw httpError('Utente non trovato', 404);
      if (permissions !== undefined) {
        // Un admin non può togliersi da solo il ruolo admin: così ne resta sempre almeno uno
        if (u.id === me.id && !permissions.includes('admin')) {
          throw httpError('Non puoi togliere a te stesso il permesso admin', 400);
        }
        u.permissions = [...new Set(permissions as string[])];
      }
      if (pwHash) {
        u.password = pwHash;
        u.passwordChangedAt = Date.now(); // chiude le sessioni aperte di quell'utente
      }
      return u;
    });
    console.log(`[users] ${me.username} ha modificato ${user.username}:`,
      [permissions !== undefined && `permessi [${user.permissions.join(',')}]`, pwHash && 'password'].filter(Boolean).join(', '));
    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    return fail(e);
  }
}

// Elimina un utente (solo admin, non sé stessi)
export async function DELETE(req: Request, { params }: Ctx) {
  const me = await authorize(req, 'admin');
  if (me instanceof NextResponse) return me;
  const id = Number((await params).id);
  if (id === me.id) return NextResponse.json({ error: 'Non puoi eliminare il tuo account' }, { status: 400 });

  try {
    const removed = await updateUsers(users => {
      const i = users.findIndex(x => x.id === id);
      if (i < 0) throw httpError('Utente non trovato', 404);
      return users.splice(i, 1)[0];
    });
    console.log(`[users] ${me.username} ha eliminato ${removed.username}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}
