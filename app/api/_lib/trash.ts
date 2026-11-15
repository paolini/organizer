import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { TRASH_NAME, resolveInRoot } from './paths';

// Struttura del cestino, nella radice della libreria:
//   .trash/.ndignore              Navidrome ignora la cartella
//   .trash/<id>/.meta.json        { originalPath, type, deletedAt, deletedBy, size }
//   .trash/<id>/<nome originale>  il file o la cartella eliminata

export type TrashMeta = {
  originalPath: string;
  type: 'file' | 'directory';
  deletedAt: number;
  deletedBy: string;
  size: number;
};
export type TrashEntry = TrashMeta & { id: string; name: string };

const META = '.meta.json';
const ID_RE = /^\d{13}-[0-9a-f]{8}$/;

/** Giorni dopo i quali gli elementi vengono eliminati definitivamente (0 = mai) */
export function retentionDays() {
  const n = Number(process.env.TRASH_DAYS ?? 30);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

function trashRoot(rootDir: string) {
  return path.join(path.resolve(rootDir), TRASH_NAME);
}

export function isValidTrashId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

async function ensureTrash(rootDir: string) {
  const dir = trashRoot(rootDir);
  await fs.mkdir(dir, { recursive: true });
  // File vuoto: Navidrome salta le cartelle che contengono .ndignore
  await fs.writeFile(path.join(dir, '.ndignore'), '', { flag: 'a' });
  return dir;
}

async function exists(p: string) {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function sizeOf(p: string): Promise<number> {
  const st = await fs.lstat(p);
  if (!st.isDirectory()) return st.size;
  let total = 0;
  for (const e of await fs.readdir(p)) total += await sizeOf(path.join(p, e));
  return total;
}

/** rename, con ripiego su copia + cancellazione se sorgente e destinazione
 *  stanno su filesystem diversi (es. una sottocartella montata a parte) */
async function moveAny(src: string, dest: string) {
  try {
    await fs.rename(src, dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
    await fs.cp(src, dest, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    await fs.rm(src, { recursive: true });
  }
}

/** Sposta nel cestino l'elemento al path relativo rel. Restituisce l'id. */
export async function moveToTrash(rootDir: string, rel: string, username: string): Promise<string> {
  const abs = resolveInRoot(rootDir, rel, false);
  if (!abs) throw new Error('Accesso non consentito');
  const st = await fs.lstat(abs);
  const dir = await ensureTrash(rootDir);
  const id = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const slot = path.join(dir, id);
  await fs.mkdir(slot);
  const meta: TrashMeta = {
    originalPath: path.relative(path.resolve(rootDir), abs),
    type: st.isDirectory() ? 'directory' : 'file',
    deletedAt: Date.now(),
    deletedBy: username,
    size: await sizeOf(abs),
  };
  try {
    await moveAny(abs, path.join(slot, path.basename(abs)));
  } catch (e) {
    await fs.rm(slot, { recursive: true, force: true });
    throw e;
  }
  await fs.writeFile(path.join(slot, META), JSON.stringify(meta, null, 2));
  return id;
}

async function readEntry(rootDir: string, id: string): Promise<TrashEntry | null> {
  const slot = path.join(trashRoot(rootDir), id);
  try {
    const meta = JSON.parse(await fs.readFile(path.join(slot, META), 'utf8')) as TrashMeta;
    return { ...meta, id, name: path.basename(meta.originalPath) };
  } catch {
    return null;
  }
}

/** Elenco del cestino, dal più recente. Elimina prima gli elementi scaduti. */
export async function listTrash(rootDir: string): Promise<TrashEntry[]> {
  await purgeExpired(rootDir);
  let ids: string[];
  try {
    ids = (await fs.readdir(trashRoot(rootDir))).filter(isValidTrashId);
  } catch {
    return [];
  }
  const entries = (await Promise.all(ids.map(id => readEntry(rootDir, id)))).filter((e): e is TrashEntry => !!e);
  return entries.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** "nome (2).ext", "nome (3).ext"… finché non trova un nome libero */
async function freeName(dir: string, name: string) {
  if (!(await exists(path.join(dir, name)))) return name;
  const dot = name.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!(await exists(path.join(dir, candidate)))) return candidate;
  }
}

/** Rimette l'elemento al suo posto (ricreando le cartelle mancanti).
 *  Se il nome è stato riusato nel frattempo aggiunge un suffisso. Restituisce il path finale. */
export async function restoreFromTrash(rootDir: string, id: string): Promise<string> {
  const entry = await readEntry(rootDir, id);
  if (!entry) throw new Error('Elemento non trovato nel cestino');
  const target = resolveInRoot(rootDir, entry.originalPath, false);
  if (!target) throw new Error('Posizione originale non valida');
  const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true });
  const finalName = await freeName(parent, entry.name);
  const slot = path.join(trashRoot(rootDir), id);
  await moveAny(path.join(slot, entry.name), path.join(parent, finalName));
  await fs.rm(slot, { recursive: true, force: true });
  return path.relative(path.resolve(rootDir), path.join(parent, finalName));
}

export async function purgeFromTrash(rootDir: string, id: string) {
  const slot = path.join(trashRoot(rootDir), id);
  if (!(await exists(slot))) throw new Error('Elemento non trovato nel cestino');
  await fs.rm(slot, { recursive: true, force: true });
}

export async function purgeExpired(rootDir: string) {
  const days = retentionDays();
  if (!days) return;
  const limit = Date.now() - days * 24 * 3600 * 1000;
  let ids: string[];
  try {
    ids = (await fs.readdir(trashRoot(rootDir))).filter(isValidTrashId);
  } catch {
    return;
  }
  for (const id of ids) {
    // l'id inizia con l'istante di eliminazione
    if (Number(id.slice(0, 13)) < limit) {
      await fs.rm(path.join(trashRoot(rootDir), id), { recursive: true, force: true });
      console.log(`[trash] scaduto, eliminato definitivamente: ${id}`);
    }
  }
}
