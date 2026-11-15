import type { NodeType } from "./types";
import { parentOf } from "./types";

export const DRAG_MIME = "application/x-organizer-items";

export type DragItem = { path: string; type: NodeType };

/** Elimina gli elementi che non possono essere spostati in destDir
 *  (già lì, oppure la cartella di destinazione stessa o un suo antenato). */
export function movableTo(items: DragItem[], destDir: string): DragItem[] {
  return items.filter(it => {
    if (parentOf(it.path) === destDir) return false;
    if (it.type === "directory" && (destDir === it.path || destDir.startsWith(it.path + "/"))) return false;
    return true;
  });
}
