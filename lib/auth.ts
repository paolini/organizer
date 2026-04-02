import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_change_me';

export async function readUsers() {
  try {
    const txt = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    return [];
  }
}

export async function writeUsers(users: any[]) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
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

export function getTokenFromReq(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parseCookie(cookieHeader || '');
  return cookies.token as string | undefined;
}

export async function getUserFromReq(req: Request) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload || !payload.username) return null;
  const users = await readUsers();
  return users.find((u: any) => u.username === payload.username) || null;
}
