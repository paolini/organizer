import { NextRequest, NextResponse } from "next/server";
import { join, dirname, relative, sep } from "path";
import fs from "fs/promises";
import { statSync, existsSync } from "fs";
import { requireAuth } from "../../_lib/auth";

// Directory root configurabile via env
const ROOT = process.env.TARGET_DIR || "./data";

// Trova la cartella comune più profonda tra tutti i path
function getCommonAncestor(paths: string[]): string {
  if (paths.length === 0) return "";
  const splitPaths = paths.map(p => p.split(sep));
  let i = 0;
  while (splitPaths.every(parts => parts[i] === splitPaths[0][i])) {
    i++;
    if (i >= splitPaths[0].length) break;
  }
  const ancestor = splitPaths[0].slice(0, i).join(sep);
  console.log("[move] Common ancestor:", ancestor);
  return ancestor;
}


// Sposta file e directory ricorsivamente
async function moveSelectedItems(items: { path: string, type: "file" | "directory" }[], destDir: string) {
  console.log("[move] items:", items);
  console.log("[move] destDir:", destDir);
  const moved: string[] = [];
  const removedDirs: string[] = [];

  async function moveFile(src: string, dest: string) {
    const destFolder = dirname(dest);
    if (!existsSync(destFolder)) await fs.mkdir(destFolder, { recursive: true });
    await fs.rename(src, dest);
    moved.push(dest);
    console.log(`[move] Spostato file ${src} -> ${dest}`);
  }

  async function moveDir(srcDir: string, destDir: string) {
    // Leggi tutto il contenuto
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);
      if (entry.isDirectory()) {
        await moveDir(srcPath, destPath);
      } else {
        await moveFile(srcPath, destPath);
      }
    }
    // Rimuovi la cartella sorgente se vuota
    await fs.rmdir(srcDir);
    removedDirs.push(srcDir);
    console.log(`[move] Rimossa cartella vuota: ${srcDir}`);
  }

  for (const item of items) {
    if (item.type === "file") {
      const srcAbs = join(ROOT, item.path);
      const destAbs = join(ROOT, destDir, item.path.split(sep).pop()!);
      await moveFile(srcAbs, destAbs);
    } else if (item.type === "directory") {
      const srcAbs = join(ROOT, item.path);
      const destAbs = join(ROOT, destDir, item.path.split(sep).pop()!);
      if (!existsSync(destAbs)) await fs.mkdir(destAbs, { recursive: true });
      await moveDir(srcAbs, destAbs);
    }
  }
  return { moved, removedDirs };
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[move] Errore parsing JSON:", e);
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const { items, destDir } = body;
  console.log("[move] BODY ricevuto:", body);
  if (!Array.isArray(items) || typeof destDir !== "string") {
    console.error("[move] Parametri non validi:", { items, destDir });
    return NextResponse.json({ error: "Parametri non validi" }, { status: 400 });
  }
  items.forEach((item, i) => {
    console.log(`[move] item[${i}]:`, item, "typeof:", typeof item, "keys:", Object.keys(item));
  });
  try {
    const result = await moveSelectedItems(items, destDir);
    console.log("[move] Risultato:", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[move] Errore:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
