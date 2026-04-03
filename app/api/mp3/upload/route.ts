import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../../../lib/auth';
import fs from 'fs/promises';

export const runtime = 'nodejs'; // Forza Node.js runtime per supporto fs

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

  const url = new URL(req.url);
  const relDir = url.searchParams.get('dir') || '';
  const targetDir = path.resolve(rootDir, relDir);
  if (!targetDir.startsWith(rootDir)) {
    return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'File mancante o non valido' }, { status: 400 });
  }
  const fileName = formData.get('name') || file.name || 'upload.bin';
  const destPath = path.join(targetDir, path.basename(fileName));
  try {
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));
    return NextResponse.json({ ok: true, file: path.relative(rootDir, destPath) });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile salvare il file', details: String(err) }, { status: 500 });
  }
}
