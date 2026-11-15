import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getUserFromReq } from "../../_lib/auth";
import { resolveInRoot } from "../../_lib/paths";

type Item = { path: string; type: "file" | "directory" };
type Result = { file: string; ok: boolean; error?: string };

async function exists(p: string) {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

/** Unisce srcDir dentro destDir (che esiste già). I file con lo stesso nome
 *  non vengono sovrascritti: restano nella sorgente e vengono segnalati. */
async function mergeDir(srcDir: string, destDir: string, conflicts: string[]) {
  for (const entry of await fs.readdir(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (!(await exists(dest))) {
      await fs.rename(src, dest);
    } else if (entry.isDirectory() && (await fs.lstat(dest)).isDirectory()) {
      await mergeDir(src, dest, conflicts);
    } else {
      conflicts.push(dest);
    }
  }
  // Rimuove la sorgente solo se è rimasta vuota
  if ((await fs.readdir(srcDir)).length === 0) await fs.rmdir(srcDir);
}

// API: sposta file e cartelle in destDir. Body: { items: [{ path, type }], destDir }
export async function POST(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Array.isArray(user.permissions) || !user.permissions.includes("write")) {
    return NextResponse.json({ error: "Forbidden: missing write permission" }, { status: 403 });
  }

  const rootDir = process.env.TARGET_DIR || "";
  if (!rootDir) return NextResponse.json({ error: "Variabile TARGET_DIR non impostata" }, { status: 500 });
  const root = path.resolve(rootDir);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const { items, destDir } = body ?? {};
  if (!Array.isArray(items) || typeof destDir !== "string") {
    return NextResponse.json({ error: "Parametri non validi" }, { status: 400 });
  }

  const destAbs = resolveInRoot(rootDir, destDir);
  if (!destAbs) return NextResponse.json({ error: "Destinazione non consentita" }, { status: 403 });
  try {
    if (!(await fs.stat(destAbs)).isDirectory()) throw new Error();
  } catch {
    return NextResponse.json({ error: "La destinazione non è una cartella esistente" }, { status: 400 });
  }

  const results: Result[] = [];
  for (const item of items as Item[]) {
    const rel = typeof item?.path === "string" ? item.path : "";
    const src = resolveInRoot(rootDir, rel, false);
    if (!src) {
      results.push({ file: rel, ok: false, error: "Accesso non consentito" });
      continue;
    }
    const dest = path.join(destAbs, path.basename(src));
    try {
      const st = await fs.lstat(src);
      if (dest === src) {
        results.push({ file: rel, ok: true }); // già lì
        continue;
      }
      if (st.isDirectory() && (destAbs === src || destAbs.startsWith(src + path.sep))) {
        results.push({ file: rel, ok: false, error: "Impossibile spostare una cartella dentro sé stessa" });
        continue;
      }
      if (!(await exists(dest))) {
        await fs.rename(src, dest);
        results.push({ file: rel, ok: true });
      } else if (st.isDirectory() && (await fs.lstat(dest)).isDirectory()) {
        const conflicts: string[] = [];
        await mergeDir(src, dest, conflicts);
        results.push(conflicts.length
          ? { file: rel, ok: false, error: `cartelle unite, ma ${conflicts.length} file già esistenti non sono stati sovrascritti: ${conflicts.map(c => path.relative(root, c)).join(", ")}` }
          : { file: rel, ok: true });
      } else {
        results.push({ file: rel, ok: false, error: "Esiste già un elemento con lo stesso nome nella destinazione" });
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      results.push({ file: rel, ok: false, error: code === "ENOENT" ? "Non trovato" : String(err) });
    }
  }
  console.log(`[move] ${user.username} -> /${destDir}:`, results.map(r => `${r.ok ? "OK" : "ERR"} ${r.file}`).join(", "));
  return NextResponse.json({ results });
}
