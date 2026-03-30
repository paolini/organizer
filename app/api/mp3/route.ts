import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

// Restituisce la lista dei file mp3 nella cartella /public/mp3
// Funzione ricorsiva per ottenere la struttura di una directory
async function readDirRecursive(dirPath: string): Promise<any[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return {
        name: entry.name,
        type: 'directory',
        children: await readDirRecursive(fullPath)
      };
    } else {
      return {
        name: entry.name,
        type: 'file'
      };
    }
  }));
  return result;
}

// API: mostra la struttura della directory target
export async function GET() {
  const rootDir = process.env.MP3_DIR || '';
  if (!rootDir) {
    return NextResponse.json({ error: 'Variabile MP3_DIR non impostata' }, { status: 500 });
  }
  try {
    const tree = await readDirRecursive(rootDir);
    return NextResponse.json({ tree });
  } catch (err) {
    return NextResponse.json({ error: 'Impossibile leggere la cartella', details: String(err) }, { status: 500 });
  }
}
