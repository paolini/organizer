import { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { resolveInRoot } from '../../_lib/paths';
import { moveToTrash, purgeExpired } from '../../_lib/trash';

// API: sposta file e cartelle nel cestino. Body: { items: [{ path, type }] }
// Risponde con l'id nel cestino di ogni elemento, per poter annullare.
export async function POST(req: Request) {
  const user = await authorize(req, 'write');
  if (user instanceof NextResponse) return user;

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items deve essere un array non vuoto' }, { status: 400 });
  }

  const results: { file: string; ok: boolean; trashId?: string; error?: string }[] = [];
  for (const item of items) {
    const rel = typeof item?.path === 'string' ? item.path : '';
    // allowRoot=false: la root della libreria non si può mai eliminare
    if (!resolveInRoot(rootDir, rel, false)) {
      results.push({ file: rel, ok: false, error: 'Accesso non consentito' });
      continue;
    }
    try {
      const trashId = await moveToTrash(rootDir, rel, user.username);
      results.push({ file: rel, ok: true, trashId });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      results.push({ file: rel, ok: false, error: code === 'ENOENT' ? 'Non trovato' : String(err) });
    }
  }
  console.log(`[delete] ${user.username} -> cestino:`, results.map(r => `${r.ok ? 'OK' : 'ERR'} ${r.file}`).join(', '));
  purgeExpired(rootDir).catch(e => console.error('[trash] pulizia scaduti fallita:', e));
  return NextResponse.json({ results });
}
