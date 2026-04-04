import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../_lib/auth';

export async function POST(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!Array.isArray(user.permissions) || !user.permissions.includes('write')) {
    return NextResponse.json({ error: 'Forbidden: missing write permission' }, { status: 403 });
  }

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) {
    return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { parentDir, name } = body;
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name deve essere una stringa non vuota' }, { status: 400 });
  }

  // Prevent path traversal in name
  if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    return NextResponse.json({ error: 'Nome cartella non valido' }, { status: 400 });
  }

  const parent = typeof parentDir === 'string' ? parentDir : '';
  const targetPath = path.resolve(rootDir, parent, name);
  if (!targetPath.startsWith(rootDir)) {
    return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  }

  try {
    await fs.mkdir(targetPath, { recursive: false });
    return NextResponse.json({ ok: true, path: path.relative(rootDir, targetPath) });
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      return NextResponse.json({ error: 'La cartella esiste già' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Impossibile creare la cartella', details: String(err) }, { status: 500 });
  }
}
