import path from 'path';

/** Risolve un path relativo dentro TARGET_DIR.
 *  Restituisce null se il path esce dalla root (path traversal).
 *  Con allowRoot=false rifiuta anche la root stessa. */
export function resolveInRoot(rootDir: string, rel: string, allowRoot = true): string | null {
  const root = path.resolve(rootDir);
  const abs = path.resolve(root, rel);
  const r = path.relative(root, abs);
  if (r.startsWith('..') || path.isAbsolute(r)) return null;
  if (!allowRoot && r === '') return null;
  return abs;
}

/** Nome di file/cartella valido (niente separatori, niente . o ..) */
export function isValidName(name: unknown): name is string {
  return typeof name === 'string'
    && name.trim() !== ''
    && name === name.trim()
    && !/[\/\\\0]/.test(name)
    && name !== '.' && name !== '..';
}
