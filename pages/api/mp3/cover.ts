import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import nodeID3 from 'node-id3';
import { parseFile } from 'music-metadata';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
import os from 'os';
import { getUserFromReq } from '../../../app/api/_lib/auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!Array.isArray(user.permissions) || !user.permissions.includes('write')) {
    return res.status(403).json({ error: 'Forbidden: missing write permission' });
  }

  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) return res.status(500).json({ error: 'Variabile TARGET_DIR non impostata' });

  const form = formidable({ maxFileSize: 5 * 1024 * 1024 }); // 5MB

  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) return res.status(400).json({ error: String(err) });
    let relPath = '';
    if (Array.isArray(fields.path)) relPath = String(fields.path[0] || '');
    else relPath = String(fields.path || '');
    if (!relPath) return res.status(400).json({ error: 'Field "path" mancante' });

    const targetFile = path.resolve(rootDir, relPath);
    if (!targetFile.startsWith(rootDir)) return res.status(403).json({ error: 'Accesso non consentito' });

    // files.image might be an array depending on formidable version / client
    const rawImg = files.image as any;
    const img = Array.isArray(rawImg) ? rawImg[0] : rawImg;
    if (!img) return res.status(400).json({ error: 'File immagine mancante (campo "image")' });

    try {
      const data = await fs.readFile(img.filepath);
      const mime = img.mimetype || img.type || 'image/jpeg';
      const tags = {
        image: {
          mime,
          type: 3,
          description: 'cover',
          image: data,
        },
      };
      const ok = await nodeID3.update(tags as any, targetFile);
      if (!ok) throw new Error('node-id3 update failed');
      // also try reading with music-metadata to detect embedded pictures
      try {
        const mm = await parseFile(targetFile, { duration: false });
        const common = mm.common || {};
        // If music-metadata found no pictures, try an alternate write method
        if (!(common.picture || []).length) {
          try {
            const writeOk = nodeID3.write(tags as any, targetFile);
            // re-parse
            const mm2 = await parseFile(targetFile, { duration: false });
              // If still no picture, try ffmpeg CLI to embed the image (safer)
              if (!(mm2.common?.picture || []).length) {
                try {
                  const tmpImage = path.join(os.tmpdir(), `cover-${Date.now()}${path.extname(img.originalFilename || img.filepath) || '.jpg'}`);
                  const tmpOut = path.join(os.tmpdir(), `out-${Date.now()}.mp3`);
                  await fs.writeFile(tmpImage, data);
                  await execFileAsync('ffmpeg', ['-y', '-i', targetFile, '-i', tmpImage, '-map', '0', '-map', '1', '-c', 'copy', '-id3v2_version', '3', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)', tmpOut]);
                  try {
                    await fs.rename(tmpOut, targetFile);
                  } catch (renameErr) {
                    await fs.copyFile(tmpOut, targetFile);
                    await fs.unlink(tmpOut).catch(() => {});
                  }
                  await fs.unlink(tmpImage).catch(()=>{});
                } catch (ffe) {
                  console.debug('cover upload: ffmpeg embed failed', String(ffe));
                }
              }
          } catch (fw) {
            console.debug('cover upload: fallback write failed', String(fw));
          }
        }
      } catch (mmErr) {
        console.debug('cover upload: music-metadata read failed', String(mmErr));
      }
      // read back tags
      try {
        await nodeID3.read(targetFile);
      } catch (rerr) {
        // read-back failed
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.debug('cover upload: error', String(e));
      return res.status(500).json({ error: String(e) });
    }
  });
}
