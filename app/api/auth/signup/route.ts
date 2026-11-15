import { NextResponse } from 'next/server';
import {
  readUsers, updateUsers, hashPassword, publicUser,
  isValidUsername, passwordProblem, type User,
} from '../../_lib/auth';

// La registrazione libera è chiusa, salvo ALLOW_SIGNUP=true.
// Eccezione: se non esiste ancora nessun utente, il primo che si registra diventa admin.
function signupOpen() {
  return process.env.ALLOW_SIGNUP === 'true';
}

export async function GET() {
  const users = await readUsers();
  return NextResponse.json({ enabled: users.length === 0 || signupOpen(), firstUser: users.length === 0 });
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { username, password } = body ?? {};
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: 'Nome utente non valido (2-32 caratteri: lettere, numeri, . _ -)' }, { status: 400 });
  }
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const pwHash = await hashPassword(password);
  try {
    const user = await updateUsers(users => {
      const first = users.length === 0;
      if (!first && !signupOpen()) throw Object.assign(new Error('La registrazione è chiusa. Chiedi un account a un amministratore.'), { status: 403 });
      if (users.some(u => u.username === username)) throw Object.assign(new Error('Nome utente già in uso'), { status: 409 });
      const u: User = {
        id: Date.now(),
        username,
        password: pwHash,
        // il primo utente amministra; gli altri attendono che un admin assegni i permessi
        permissions: first ? ['read', 'write', 'admin'] : [],
      };
      users.push(u);
      return u;
    });
    return NextResponse.json({ success: true, user: publicUser(user) });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
