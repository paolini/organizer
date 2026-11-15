import { NextResponse } from 'next/server';
import {
  readUsers, verifyPassword, hashPassword, sessionCookie, publicUser,
  clientIp, loginBlockedFor, recordLoginFailure, clearLoginFailures,
} from '../../_lib/auth';

// Hash fittizio usato quando l'utente non esiste, così i tempi di risposta non rivelano quali utenti esistono
const dummyHash = hashPassword('dummy-password');

export async function POST(req: Request) {
  // Limite per IP (non per utente, così nessuno può bloccare l'account altrui)
  const key = clientIp(req);
  const wait = loginBlockedFor(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Troppi tentativi falliti. Riprova tra ${Math.ceil(wait / 60)} minuti.` },
      { status: 429, headers: { 'Retry-After': String(wait) } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { username, password } = body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return NextResponse.json({ error: 'Inserisci utente e password' }, { status: 400 });
  }

  const users = await readUsers();
  const user = users.find(u => u.username === username);
  const ok = await verifyPassword(password, user?.password ?? await dummyHash);
  if (!user || !ok) {
    recordLoginFailure(key);
    return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 });
  }
  clearLoginFailures(key);
  return NextResponse.json(
    { success: true, user: publicUser(user) },
    { headers: { 'Set-Cookie': sessionCookie(user.username) } }
  );
}
