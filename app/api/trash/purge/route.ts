import { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { isValidTrashId, listTrash, purgeFromTrash } from '../../_lib/trash';

// Eliminazione definitiva (solo admin). Body: { ids: string[] } oppure { all: true }
export async function POST(req: Request) {
  const user = await authorize(req, 'admin');
  if (user instanceof NextResponse) return user;
  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  let ids: unknown[];
  if (body?.all === true) ids = (await listTrash(rootDir)).map(e => e.id);
  else if (Array.isArray(body?.ids) && body.ids.length > 0) ids = body.ids;
  else return NextResponse.json({ error: 'Specificare ids oppure all: true' }, { status: 400 });

  const results: { file: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    if (!isValidTrashId(id)) {
      results.push({ file: String(id), ok: false, error: 'id non valido' });
      continue;
    }
    try {
      await purgeFromTrash(rootDir, id);
      results.push({ file: id, ok: true });
    } catch (e) {
      results.push({ file: id, ok: false, error: (e as Error).message });
    }
  }
  console.log(`[trash] ${user.username} ha eliminato definitivamente ${results.filter(r => r.ok).length} elementi`);
  return NextResponse.json({ results });
}
