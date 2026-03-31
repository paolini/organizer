import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

// API: restituisce info base e tag se mp3/flac
export async function GET(req: Request) {
  const rootDir = process.env.MP3_DIR || '';
  if (!rootDir) {
    return NextResponse.json({ error: 'Variabile MP3_DIR non impostata' }, { status: 500 });
  }
  const url = new URL(req.url);
  const relPath = url.searchParams.get('path') || '';
  const targetFile = path.resolve(rootDir, relPath);
  if (!targetFile.startsWith(rootDir)) {
    return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });
  }
  try {
    const stat = await fs.stat(targetFile);
    const ext = path.extname(targetFile).slice(1).toLowerCase();
    let tags = null;
    if (stat.isFile() && (ext === 'mp3' || ext === 'flac')) {
      // Qui andrebbe la lettura dei tag (placeholder)
      tags = { esempio: 'Qui verranno mostrati i tag audio' };
    }
    return NextResponse.json({
      size: stat.size,
      ext,
      tags,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile leggere info file', details: String(err) }, { status: 500 });
  }
}
