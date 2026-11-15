"use client";
import { useEffect, useState } from "react";
import { FolderTree } from "./FolderTree";
import type { FileTree } from "./types";
import { ancestorsOf } from "./types";

type Props = {
  fileTree: FileTree;
  loadDir: (path: string) => void;
  initialDir: string;
  count: number;
  onConfirm: (destDir: string) => void;
  onCancel: () => void;
};

export function MoveDialog({ fileTree, loadDir, initialDir, count, onConfirm, onCancel }: Props) {
  const [dest, setDest] = useState(initialDir);
  const [expanded, setExpanded] = useState(() => new Set(ancestorsOf(initialDir)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function toggle(path: string) {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else {
      next.add(path);
      if (fileTree[path] == null) loadDir(path);
    }
    setExpanded(next);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="move-title" onClick={e => e.stopPropagation()}>
        <h3 id="move-title">Sposta {count} {count === 1 ? "elemento" : "elementi"} in…</h3>
        <div className="modal-tree">
          <FolderTree
            fileTree={fileTree}
            expanded={expanded}
            onToggle={toggle}
            current={dest}
            onSelect={setDest}
          />
        </div>
        <div className="modal-actions">
          <span className="muted dest-label">Destinazione: <b>/{dest}</b></span>
          <button className="btn" onClick={onCancel}>Annulla</button>
          <button className="btn btn-primary" onClick={() => onConfirm(dest)} disabled={dest === initialDir}>Sposta qui</button>
        </div>
      </div>
    </div>
  );
}
