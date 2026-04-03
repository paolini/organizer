import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Per conversione
let ffmpeg: any;
try {
  ffmpeg = require("fluent-ffmpeg");
} catch {
  // fallback: non installato
}

const AUDIO_ROOT = process.env.TARGET_DIR || path.resolve(process.cwd(), "public/audio");

export async function POST(req: NextRequest) {
  if (!ffmpeg) {
    return NextResponse.json({ error: "fluent-ffmpeg non installato sul server." }, { status: 500 });
  }
  let files: string[] = [];
  try {
    const body = await req.json();
    files = Array.isArray(body.files) ? body.files : (body.path ? [body.path] : []);
    if (!files.length) throw new Error("Nessun file specificato.");
  } catch (e: any) {
    return NextResponse.json({ error: "Richiesta non valida: " + e.message }, { status: 400 });
  }

  const results = await Promise.all(files.map(async (relPath) => {
    try {
      if (!relPath.toLowerCase().endsWith(".flac")) throw new Error("Non è un file FLAC");
      const absPath = path.join(AUDIO_ROOT, relPath);
      const mp3Path = absPath.replace(/\.flac$/i, ".mp3");
      // Verifica esistenza
      await fs.access(absPath);
      // Conversione
      await new Promise((resolve, reject) => {
        ffmpeg(absPath)
          .output(mp3Path)
          .audioCodec("libmp3lame")
          .on("end", resolve)
          .on("error", reject)
          .run();
      });
      return { file: relPath, ok: true };
    } catch (e: any) {
      return { file: relPath, ok: false, error: e.message };
    }
  }));

  return NextResponse.json({ results });
}
