import { Node } from "./types";

/** Ricorsivamente raccoglie tutti i file a partire da una lista di nodi */
export function getAllFiles(
  nodes: Node[] | null | undefined,
  base: string,
  fileTree: Record<string, Node[] | null>
): string[] {
  let files: string[] = [];
  if (!nodes) return files;
  for (const n of nodes) {
    const p = base ? base + "/" + n.name : n.name;
    if (n.type === "file") files.push(p);
    else if (n.type === "directory") {
      files = files.concat(getAllFiles(fileTree[p], p, fileTree));
    }
  }
  return files;
}
