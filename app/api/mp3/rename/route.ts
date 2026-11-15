import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../_lib/auth';
import { resolveInRoot, isValidName } from '../../_lib/paths';

// API: rinomina un file o una cartella. Body: { path, newName }
export async function POST(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!Array.isArray(user.permissions) || !user.permissions.includes('write')) {
    return NextResponse.json({ error: 'Forbidden: missing write permission' }, { status: 403 });
  }

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { path: relPath, newName } = body ?? {};
  if (typeof relPath !== 'string') return NextResponse.json({ error: 'path mancante' }, { status: 400 });
  if (!isValidName(newName)) return NextResponse.json({ error: 'Nome non valido' }, { status: 400 });

  const src = resolveInRoot(rootDir, relPath, false);
  if (!src) return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  const dest = path.join(path.dirname(src), newName);

  if (dest === src) return NextResponse.json({ ok: true, path: relPath });

  try {
    await fs.stat(src);
  } catch {
    return NextResponse.json({ error: 'Elemento non trovato' }, { status: 404 });
  }

  // fs.rename sovrascrive i file esistenti: lo impediamo esplicitamente.
  // Eccezione: cambio solo di maiuscole/minuscole su filesystem case-insensitive.
  const caseOnly = dest.toLowerCase() === src.toLowerCase();
  if (!caseOnly) {
    try {
      await fs.lstat(dest);
      return NextResponse.json({ error: `Esiste già un elemento chiamato “${newName}”` }, { status: 409 });
    } catch { /* non esiste: ok */ }
  }

  try {
    await fs.rename(src, dest);
    return NextResponse.json({ ok: true, path: path.relative(path.resolve(rootDir), dest) });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile rinominare', details: String(err) }, { status: 500 });
  }
}
