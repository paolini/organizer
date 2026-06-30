import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import type { NextApiRequest } from 'next';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_change_me';

export async function readUsers() {
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

export async function writeUsers(users: any[]) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  const tmpFile = `${USERS_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(users, null, 2), 'utf8');
  await fs.rename(tmpFile, USERS_FILE);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: object) {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch (e) {
    return null;
  }
}

export function getTokenFromReq(req: any) {
  // Compatibile sia con Web API Request (app router) che NextApiRequest (pages router)
  let cookieHeader = '';
  if (req?.headers) {
    if (typeof req.headers.get === 'function') {
      cookieHeader = req.headers.get('cookie') || '';
    } else if (typeof req.headers.cookie === 'string') {
      cookieHeader = req.headers.cookie;
    } else if (typeof req.headers['cookie'] === 'string') {
      cookieHeader = req.headers['cookie'];
    }
  }
  const cookies = parseCookie(cookieHeader || '');
  return cookies.token as string | undefined;
}

export async function getUserFromReq(req: Request | NextApiRequest) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload || !payload.username) return null;
  const users = await readUsers();
  return users.find((u: any) => u.username === payload.username) || null;
}

// Wrapper per compatibilità API Next.js
export async function requireAuth(req: Request | NextApiRequest) {
  const user = await getUserFromReq(req);
  if (!user) throw new Error('Unauthorized');
  return user;
}
