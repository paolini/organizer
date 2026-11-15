
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../_lib/auth';
import { resolveInRoot, TRASH_NAME } from '../_lib/paths';

// API: mostra la lista di file/cartelle di una directory (non ricorsivo)
export async function GET(req: Request) {
  // Autenticazione minima: richiede token
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Require read permission
  if (!Array.isArray(user.permissions) || !user.permissions.includes('read')) {
    return NextResponse.json({ error: 'Forbidden: missing read permission' }, { status: 403 });
  }

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) {
    return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });
  }

  // Prendi il path richiesto dalla query string (es: ?path=subdir1/subdir2)
  const url = new URL(req.url);
  const relPath = url.searchParams.get('path') || '';
  // Normalizza e previeni path traversal
  const targetDir = resolveInRoot(rootDir, relPath);
  if (!targetDir) {
    return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  }

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const isRoot = targetDir === path.resolve(rootDir);
    const children = entries
      .filter(entry => !(isRoot && entry.name === TRASH_NAME))
      .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));
    return NextResponse.json({ path: relPath, children });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile leggere la cartella', details: String(err) }, { status: 500 });
  }
}
