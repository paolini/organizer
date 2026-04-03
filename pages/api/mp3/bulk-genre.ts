import fs from 'fs/promises';
import path from 'path';
import nodeID3 from 'node-id3';
import { getUserFromReq } from '../../../app/api/_lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';

const AUDIO_EXTS = ['.mp3', '.flac'];

async function collectAudioFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectAudioFiles(full));
    } else if (AUDIO_EXTS.includes(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

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

  // Accept { items: [{path, type}], genre }
  if (!Array.isArray(body.items)) {
    return res.status(400).json({ error: 'items deve essere array e genre stringa' });
  }
  const items: { path: string; type: string }[] = body.items;

  if (typeof body.genre !== 'string' || !body.genre.trim()) {
    return res.status(400).json({ error: 'genre deve essere una stringa non vuota' });
  }

  // Resolve items to actual audio file paths
  const resolvedFiles: string[] = [];
  for (const item of items) {
    const targetPath = path.resolve(rootDir, item.path);
    if (!targetPath.startsWith(rootDir)) continue;
    if (item.type === 'directory') {
      try {
        const audioFiles = await collectAudioFiles(targetPath);
        resolvedFiles.push(...audioFiles);
      } catch {
        // directory not found or not readable — skip
      }
    } else {
      resolvedFiles.push(targetPath);
    }
  }

  const results = [];
  for (const targetFile of resolvedFiles) {
    if (!targetFile.startsWith(rootDir)) {
      results.push({ file: path.relative(rootDir, targetFile), ok: false, error: 'Accesso non consentito' });
      continue;
    }
    const relPath = path.relative(rootDir, targetFile);
    const ext = path.extname(targetFile).toLowerCase();
    try {
      if (ext === '.mp3') {
        await fs.access(targetFile);
        const ok = await nodeID3.update({ genre: body.genre }, targetFile);
        if (!ok) throw new Error('node-id3 update fallita');
        const tag = await nodeID3.read(targetFile);
        results.push({ file: relPath, ok: true, writtenGenre: tag.genre });
      } else if (ext === '.flac') {
        // FLAC genre writing not yet supported
        results.push({ file: relPath, ok: false, error: 'Scrittura genere FLAC non ancora supportata' });
      } else {
        results.push({ file: relPath, ok: false, error: 'Formato non supportato' });
      }
    } catch (e) {
      results.push({ file: relPath, ok: false, error: String(e) });
    }
  }
  return res.status(200).json({ results });
}
