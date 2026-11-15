import { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { isValidTrashId, restoreFromTrash } from '../../_lib/trash';

// Ripristina elementi dal cestino. Body: { ids: string[] }
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
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids deve essere un array non vuoto' }, { status: 400 });
  }

  const results: { file: string; ok: boolean; path?: string; error?: string }[] = [];
  for (const id of ids) {
    if (!isValidTrashId(id)) {
      results.push({ file: String(id), ok: false, error: 'id non valido' });
      continue;
    }
    try {
      const restored = await restoreFromTrash(rootDir, id);
      results.push({ file: restored, ok: true, path: restored });
    } catch (e) {
      results.push({ file: id, ok: false, error: (e as Error).message });
    }
  }
  console.log(`[trash] ${user.username} ha ripristinato:`, results.map(r => `${r.ok ? 'OK' : 'ERR'} ${r.file}`).join(', '));
  return NextResponse.json({ results });
}
