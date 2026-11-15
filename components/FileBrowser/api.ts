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

export function downloadUrl(path: string) {
  return `/api/mp3/download?path=${encodeURIComponent(path)}`;
}

export function moveItems(items: Item[], destDir: string) {
  return postJson("/api/mp3/move", { items, destDir });
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
