import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { parseFile } from 'music-metadata';
import { getUserFromReq } from '../../../../lib/auth';

// API: restituisce info base e tag se mp3/flac
export async function GET(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Require read permission to view file info
  if (!Array.isArray(user.permissions) || !user.permissions.includes('read')) {
    return NextResponse.json({ error: 'Forbidden: missing read permission' }, { status: 403 });
  }

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
    if (stat.isFile() && (ext === 'mp3' || ext === 'flac' || ext === 'm4a' || ext === 'wav')) {
      try {
        const metadata = await parseFile(targetFile, { duration: false });
        // Prendi campi comuni e immagini (se presenti)
        const common = metadata.common || {};
        const format = metadata.format || {};
        const pictures = (common.picture || []).map((p) => ({
          mime: p.format,
          description: p.description || null,
          size: p.data ? p.data.length : 0,
        }));
        tags = {
          common: {
            title: common.title || null,
            artist: common.artist || null,
            album: common.album || null,
            year: common.year || null,
            track: common.track || null,
            genre: common.genre || null,
          },
          pictures,
          format: {
            container: format.container || null,
            codec: format.codec || null,
            sampleRate: format.sampleRate || null,
          },
        };
      } catch (e) {
        // Se la lettura dei metadata fallisce, restituisci null ma non bloccare l'API
        tags = { error: 'Impossibile leggere i tag', details: String(e) };
      }
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
