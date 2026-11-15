// Tipi di file riconosciuti, condivisi tra client e server.

export type FileKind = "audio" | "image" | "text" | "other";

const AUDIO: Record<string, string> = {
  mp3: "audio/mpeg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
};

const IMAGE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

// Testo: sempre servito come text/plain, anche json/xml, così il browser non lo interpreta
const TEXT = new Set([
  "txt", "md", "log", "nfo", "cue", "m3u", "m3u8", "pls", "lrc", "srt",
  "json", "xml", "csv", "tsv", "ini", "yml", "yaml", "toml", "sfv", "md5", "sha1", "sha256", "accurip",
]);

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function kindOf(name: string): FileKind {
  const ext = extOf(name);
  if (ext in AUDIO) return "audio";
  if (ext in IMAGE) return "image";
  if (TEXT.has(ext)) return "text";
  return "other";
}

/** MIME type con cui servire il file in linea (null = solo download) */
export function inlineMimeOf(name: string): string | null {
  const ext = extOf(name);
  if (ext in AUDIO) return AUDIO[ext];
  if (ext in IMAGE) return IMAGE[ext];
  if (TEXT.has(ext)) return "text/plain";
  return null;
}

export const KIND_ICONS: Record<FileKind, string> = {
  audio: "🎵",
  image: "🖼️",
  text: "📄",
  other: "📦",
};
