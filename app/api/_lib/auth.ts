import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { parse as parseCookie, serialize } from 'cookie';
import { NextResponse } from 'next/server';
import type { NextApiRequest } from 'next';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_change_me';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 giorni

export const PERMISSIONS = ['read', 'write', 'admin'] as const;
export type Permission = typeof PERMISSIONS[number];

export type User = {
  id: number;
  username: string;
  password: string; // hash bcrypt
  permissions: string[];
  /** ms epoch dell'ultimo cambio password: i token emessi prima non valgono più */
  passwordChangedAt?: number;
};

export type PublicUser = Pick<User, 'id' | 'username' | 'permissions'>;

export const MIN_PASSWORD_LENGTH = 8;

export function publicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, permissions: u.permissions ?? [] };
}

export function hasPermission(user: Pick<User, 'permissions'> | null | undefined, perm: Permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(perm);
}

export function isValidPermissionList(p: unknown): p is Permission[] {
  return Array.isArray(p) && p.every(x => (PERMISSIONS as readonly string[]).includes(x));
}

export function isValidUsername(u: unknown): u is string {
  return typeof u === 'string' && /^[A-Za-z0-9._-]{2,32}$/.test(u);
}

export function passwordProblem(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < MIN_PASSWORD_LENGTH) {
    return `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`;
  }
  return null;
}

export async function readUsers(): Promise<User[]> {
  try {
    const txt = await fs.readFile(USERS_FILE, 'utf8');
    const parsed = JSON.parse(txt || '[]');
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid users.json format: expected an array');
    }
    return parsed;
  } catch (e) {
    const err = e as { code?: string };
    // Missing file is valid on first startup.
    if (err?.code === 'ENOENT') return [];
    throw e;
  }
}

export async function writeUsers(users: User[]) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  const tmpFile = `${USERS_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(users, null, 2), 'utf8');
  await fs.rename(tmpFile, USERS_FILE);
}

// Serializza le modifiche a users.json all'interno del processo,
// così due richieste concorrenti non si sovrascrivono a vicenda.
let usersLock: Promise<unknown> = Promise.resolve();

/** Legge gli utenti, applica fn e salva se fn non lancia. Restituisce il valore di fn. */
export function updateUsers<T>(fn: (users: User[]) => T | Promise<T>): Promise<T> {
  const run = usersLock.then(async () => {
    const users = await readUsers();
    const result = await fn(users);
    await writeUsers(users);
    return result;
  });
  usersLock = run.catch(() => {});
  return run;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: object) {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: TOKEN_MAX_AGE });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch {
    return null;
  }
}

/** Cookie di sessione per l'utente (o di logout se username è null) */
export function sessionCookie(username: string | null) {
  // issuedAtMs: istante di emissione in ms, per confrontarlo con passwordChangedAt
  return serialize('token', username ? signToken({ username, issuedAtMs: Date.now() }) : '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: username ? TOKEN_MAX_AGE : 0,
  });
}

export function getTokenFromReq(req: Request | NextApiRequest) {
  // Compatibile sia con Web API Request (app router) che NextApiRequest (pages router)
  let cookieHeader = '';
  const headers = req?.headers as Headers | NextApiRequest['headers'] | undefined;
  if (headers) {
    if (typeof (headers as Headers).get === 'function') {
      cookieHeader = (headers as Headers).get('cookie') || '';
    } else if (typeof (headers as NextApiRequest['headers']).cookie === 'string') {
      cookieHeader = (headers as NextApiRequest['headers']).cookie as string;
    }
  }
  const cookies = parseCookie(cookieHeader || '');
  return cookies.token as string | undefined;
}

export async function getUserFromReq(req: Request | NextApiRequest): Promise<User | null> {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token) as { username?: string; iat?: number; issuedAtMs?: number } | null;
  if (!payload || !payload.username) return null;
  const users = await readUsers();
  const user = users.find(u => u.username === payload.username);
  if (!user) return null;
  // Token emesso prima dell'ultimo cambio password: non più valido
  const issuedAt = payload.issuedAtMs ?? (payload.iat ?? 0) * 1000;
  if (user.passwordChangedAt && issuedAt < user.passwordChangedAt) return null;
  return user;
}

/** Per le route dell'app router: restituisce l'utente se ha il permesso,
 *  altrimenti una NextResponse 401/403 da restituire così com'è. */
export async function authorize(req: Request, perm: Permission): Promise<User | NextResponse> {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, perm)) {
    return NextResponse.json({ error: `Forbidden: missing ${perm} permission` }, { status: 403 });
  }
  return user;
}

// Wrapper per compatibilità API Next.js
export async function requireAuth(req: Request | NextApiRequest) {
  const user = await getUserFromReq(req);
  if (!user) throw new Error('Unauthorized');
  return user;
}

// ---------- Limite ai tentativi di login ----------
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, number[]>();

export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

function recentFailures(key: string) {
  const now = Date.now();
  const list = (loginFailures.get(key) ?? []).filter(t => now - t < LOGIN_WINDOW_MS);
  if (list.length) loginFailures.set(key, list); else loginFailures.delete(key);
  return list;
}

/** Secondi da attendere se ci sono troppi tentativi falliti, altrimenti 0 */
export function loginBlockedFor(key: string) {
  const list = recentFailures(key);
  if (list.length < LOGIN_MAX_FAILURES) return 0;
  return Math.ceil((list[0] + LOGIN_WINDOW_MS - Date.now()) / 1000);
}

export function recordLoginFailure(key: string) {
  const list = recentFailures(key);
  list.push(Date.now());
  loginFailures.set(key, list);
}

export function clearLoginFailures(key: string) {
  loginFailures.delete(key);
}
