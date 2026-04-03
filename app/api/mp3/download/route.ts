import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../_lib/auth';
import { createReadStream } from 'fs';

// API: download file audio
export async function GET(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!Array.isArray(user.permissions) || !user.permissions.includes('read')) {
    return NextResponse.json({ error: 'Forbidden: missing read permission' }, { status: 403 });
  }

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) {
    return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });
  }
  const url = new URL(req.url);
  const relPath = url.searchParams.get('path') || '';
  const targetFile = path.resolve(rootDir, relPath);
  if (!targetFile.startsWith(rootDir)) {
    return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  }
  try {
    const stat = await fs.stat(targetFile);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Non è un file valido' }, { status: 400 });
    }
    const fileName = path.basename(targetFile);
    const fileStream = createReadStream(targetFile);
    return new Response(fileStream as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile scaricare il file', details: String(err) }, { status: 500 });
  }
}
