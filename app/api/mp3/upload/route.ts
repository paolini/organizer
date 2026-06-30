import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../_lib/auth';
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
  const files = formData
    .getAll('file')
    .filter((entry): entry is File => typeof entry !== 'string');
  if (files.length === 0) {
    return NextResponse.json({ error: 'File mancante o non valido' }, { status: 400 });
  }

  const explicitNames = formData
    .getAll('name')
    .filter((entry): entry is string => typeof entry === 'string');

  try {
    const savedFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = explicitNames[i] || file.name || `upload-${i + 1}.bin`;
      const destPath = path.join(targetDir, path.basename(fileName));
      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(destPath, Buffer.from(arrayBuffer));
      savedFiles.push(path.relative(rootDir, destPath));
    }

    return NextResponse.json({
      ok: true,
      file: savedFiles[0] ?? null,
      files: savedFiles,
      uploaded: savedFiles.length,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile salvare il file', details: String(err) }, { status: 500 });
  }
}
