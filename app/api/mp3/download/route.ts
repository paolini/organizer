import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { resolveInRoot } from '../../_lib/paths';
import { inlineMimeOf } from '../../../../lib/fileTypes';

/** Header Content-Disposition con nome file anche non ASCII (RFC 6266 / 5987) */
function disposition(type: 'inline' | 'attachment', fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Interpreta l'header Range (una sola porzione). null = assente o non valido */
function parseRange(header: string | null, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number, end: number;
  if (m[1] === '') { // ultimi N byte
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

// API: scarica un file. Con ?inline=1 lo serve per la visualizzazione nel browser
// (immagini, testo, audio con supporto Range per il player).
export async function GET(req: Request) {
  const user = await authorize(req, 'read');
  if (user instanceof NextResponse) return user;

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });

  const url = new URL(req.url);
  const relPath = url.searchParams.get('path') || '';
  const targetFile = resolveInRoot(rootDir, relPath, false);
  if (!targetFile) return NextResponse.json({ error: 'Accesso non consentito' }, { status: 403 });

  let size: number;
  let mtime: Date;
  try {
    const stat = await fs.stat(targetFile);
    if (!stat.isFile()) return NextResponse.json({ error: 'Non è un file valido' }, { status: 400 });
    size = stat.size;
    mtime = stat.mtime;
  } catch {
    return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
  }

  const fileName = path.basename(targetFile);
  const inlineMime = url.searchParams.get('inline') === '1' ? inlineMimeOf(fileName) : null;

  const headers: Record<string, string> = {
    'Content-Type': inlineMime ?? 'application/octet-stream',
    'Content-Disposition': disposition(inlineMime ? 'inline' : 'attachment', fileName),
    'Accept-Ranges': 'bytes',
    'Last-Modified': mtime.toUTCString(),
    'Cache-Control': 'private, no-cache',
    // Il contenuto viene dagli utenti: niente sniffing del tipo e, se aperto
    // direttamente (es. un SVG), nessuno script può girare con la nostra origine.
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
  };
  if (inlineMime === 'text/plain') headers['Content-Type'] = 'text/plain; charset=utf-8';

  const range = parseRange(req.headers.get('range'), size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = size === 0
    ? null
    : Readable.toWeb(createReadStream(targetFile, { start, end })) as ReadableStream;

  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      'Content-Length': String(size === 0 ? 0 : end - start + 1),
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
