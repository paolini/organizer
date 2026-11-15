import type { FileInfoData, Node, NodeType } from "./types";

export type TagPayload = {
  genre?: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  track?: number;
  albumArtist?: string;
};

type Item = { path: string; type: NodeType };
type ResultRow = { ok: boolean; file?: string; error?: string };

async function request<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Errore ${res.status}`);
  return data as T;
}

function postJson(url: string, body: unknown, method = "POST") {
  return request<{ results?: ResultRow[] }>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Lancia un errore se qualche riga del risultato è fallita */
function checkResults(results: ResultRow[] | undefined) {
  const failed = (results ?? []).filter(r => !r.ok);
  if (failed.length) {
    throw new Error(
      `${failed.length} elementi non elaborati:\n` +
      failed.map(r => `${r.file ?? ""}: ${r.error ?? "errore"}`).join("\n")
    );
  }
}

export async function listDir(path: string): Promise<Node[]> {
  const data = await request<{ children?: Node[] }>(`/api/mp3?path=${encodeURIComponent(path)}`);
  return data.children ?? [];
}

export function fileInfo(path: string): Promise<FileInfoData> {
  return request(`/api/mp3/fileinfo?path=${encodeURIComponent(path)}`);
}

/** URL del file: da scaricare, oppure (inline) da mostrare/suonare nel browser */
export function downloadUrl(path: string, inline = false) {
  return `/api/mp3/download?path=${encodeURIComponent(path)}${inline ? "&inline=1" : ""}`;
}

export type TextPreview = { text: string; truncated: boolean };

/** Legge al massimo maxBytes di un file di testo. Prova UTF-8, altrimenti Windows-1252
 *  (comune per .nfo e .cue). */
export async function readTextPreview(path: string, maxBytes = 256 * 1024): Promise<TextPreview> {
  const res = await fetch(downloadUrl(path, true), { headers: { Range: `bytes=0-${maxBytes - 1}` } });
  if (!res.ok && res.status !== 416) throw new Error(`Errore ${res.status}`);
  if (res.status === 416) return { text: "", truncated: false }; // file vuoto
  const buf = await res.arrayBuffer();
  const total = Number(res.headers.get("Content-Range")?.split("/")[1] ?? buf.byteLength);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    // può fallire anche solo perché il taglio è caduto a metà di un carattere UTF-8
    text = total > buf.byteLength
      ? new TextDecoder("utf-8").decode(buf)
      : new TextDecoder("windows-1252").decode(buf);
  }
  return { text, truncated: total > buf.byteLength };
}

export async function moveItems(items: Item[], destDir: string) {
  const data = await postJson("/api/mp3/move", { items, destDir });
  checkResults(data.results);
}

export function makeDir(parentDir: string, name: string) {
  return postJson("/api/mp3/mkdir", { parentDir, name });
}

export async function uploadFiles(dir: string, files: FileList | File[]): Promise<number> {
  const fd = new FormData();
  Array.from(files).forEach(f => {
    fd.append("file", f);
    fd.append("name", f.name);
  });
  const data = await request<{ uploaded?: number }>(
    `/api/mp3/upload?dir=${encodeURIComponent(dir)}`,
    { method: "POST", body: fd }
  );
  return data.uploaded ?? Array.from(files).length;
}

export async function convertToMp3(files: string[]) {
  const data = await postJson("/api/mp3/convert", { files });
  checkResults(data.results);
}

export async function writeTags(items: Item[], payload: TagPayload) {
  const data = await postJson("/api/mp3/bulk-genre", { items, ...payload }, "PATCH");
  checkResults(data.results);
}

export async function uploadCover(paths: string[], image: File) {
  const results = await Promise.all(paths.map(async p => {
    const fd = new FormData();
    fd.append("path", p);
    fd.append("image", image);
    try {
      await request("/api/mp3/cover", { method: "POST", body: fd });
      return { ok: true, file: p };
    } catch (e) {
      return { ok: false, file: p, error: (e as Error).message };
    }
  }));
  checkResults(results);
}

/** Rinomina un file o una cartella; restituisce il nuovo path relativo */
export async function renameItem(path: string, newName: string): Promise<string> {
  const data = await postJson("/api/mp3/rename", { path, newName }) as { path?: string };
  return data.path ?? path;
}

/** Sposta file e cartelle nel cestino; restituisce gli id per poterli ripristinare */
export async function deleteItems(items: Item[]): Promise<string[]> {
  const data = await postJson("/api/mp3/delete", { items }) as { results?: (ResultRow & { trashId?: string })[] };
  const ids = (data.results ?? []).filter(r => r.ok && r.trashId).map(r => r.trashId!);
  checkResults(data.results);
  return ids;
}

export type TrashEntry = {
  id: string;
  name: string;
  originalPath: string;
  type: NodeType;
  deletedAt: number;
  deletedBy: string;
  size: number;
};

export function listTrash() {
  return request<{ entries: TrashEntry[]; retentionDays: number; canPurge: boolean }>("/api/trash");
}

export async function restoreTrash(ids: string[]) {
  const data = await postJson("/api/trash/restore", { ids });
  checkResults(data.results);
}

export async function purgeTrash(ids: string[] | "all") {
  const data = await postJson("/api/trash/purge", ids === "all" ? { all: true } : { ids });
  checkResults(data.results);
}
