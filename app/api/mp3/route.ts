
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../../../lib/auth';

// API: mostra la lista di file/cartelle di una directory (non ricorsivo)
export async function GET(req: Request) {
  // Autenticazione minima: richiede token
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rootDir = process.env.MP3_DIR || '';
  if (!rootDir) {
    return NextResponse.json({ error: 'Variabile MP3_DIR non impostata' }, { status: 500 });
  }

  // Prendi il path richiesto dalla query string (es: ?path=subdir1/subdir2)
  const url = new URL(req.url);
  const relPath = url.searchParams.get('path') || '';
  // Normalizza e previeni path traversal
  const targetDir = path.resolve(rootDir, relPath);
  if (!targetDir.startsWith(rootDir)) {
    return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  }

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const children = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));
    return NextResponse.json({ path: relPath, children });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile leggere la cartella', details: String(err) }, { status: 500 });
  }
}
