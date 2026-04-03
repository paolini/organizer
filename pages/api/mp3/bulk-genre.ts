import fs from 'fs/promises';
import path from 'path';
import nodeID3 from 'node-id3';
import { getUserFromReq } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!Array.isArray(user.permissions) || !user.permissions.includes('write')) {
    return res.status(403).json({ error: 'Forbidden: missing write permission' });
  }

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) {
    return res.status(500).json({ error: 'Variabile TARGET_DIR non impostata' });
  }

  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (!Array.isArray(body.files) || typeof body.genre !== 'string') {
    return res.status(400).json({ error: 'files deve essere array e genre stringa' });
  }

  const results = [];
  for (const relPath of body.files) {
    const targetFile = path.resolve(rootDir, relPath);
    if (!targetFile.startsWith(rootDir)) {
      results.push({ file: relPath, ok: false, error: 'Accesso non consentito' });
      continue;
    }
    const ext = path.extname(targetFile).toLowerCase();
    try {
      if (ext === '.mp3') {
        await fs.access(targetFile);
        // Log valore ricevuto
        console.log('[DEBUG] Scrittura genre:', body.genre, 'su', targetFile);
        if (!body.genre || typeof body.genre !== 'string' || !body.genre.trim()) {
          results.push({ file: relPath, ok: false, error: 'Genere non valido' });
          continue;
        }
        const ok = await nodeID3.update({ genre: body.genre }, targetFile);
        if (!ok) throw new Error('node-id3 update fallita');
        // Leggi subito il tag scritto
        const tag = await nodeID3.read(targetFile);
        console.log('[DEBUG] Tag dopo update:', tag);
        results.push({ file: relPath, ok: true, writtenGenre: tag.genre });
      } else {
        results.push({ file: relPath, ok: false, error: 'Solo mp3 supportati per ora' });
      }
    } catch (e) {
      results.push({ file: relPath, ok: false, error: String(e) });
    }
  }
  return res.status(200).json({ results });
}

export const config = {
  api: {
    bodyParser: true,
  },
};
