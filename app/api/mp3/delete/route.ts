import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../_lib/auth';
import { resolveInRoot } from '../../_lib/paths';

// API: elimina definitivamente file e cartelle (ricorsivamente).
// Body: { items: [{ path, type }] }
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
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items deve essere un array non vuoto' }, { status: 400 });
  }

  const results: { file: string; ok: boolean; error?: string }[] = [];
  for (const item of items) {
    const rel = typeof item?.path === 'string' ? item.path : '';
    // allowRoot=false: la root della libreria non si può mai eliminare
    const abs = resolveInRoot(rootDir, rel, false);
    if (!abs) {
      results.push({ file: rel, ok: false, error: 'Accesso non consentito' });
      continue;
    }
    try {
      const st = await fs.lstat(abs);
      if (st.isDirectory()) await fs.rm(abs, { recursive: true });
      else await fs.unlink(abs);
      results.push({ file: rel, ok: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      results.push({ file: rel, ok: false, error: code === 'ENOENT' ? 'Non trovato' : String(err) });
    }
  }
  console.log(`[delete] ${user.username}:`, results.map(r => `${r.ok ? 'OK' : 'ERR'} ${r.file}`).join(', '));
  return NextResponse.json({ results });
}
