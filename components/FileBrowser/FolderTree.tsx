"use client";
import { useState } from "react";
import type { FileTree } from "./types";
import { joinPath } from "./types";
import { DRAG_MIME, type DragItem } from "./dnd";

type Props = {
  fileTree: FileTree;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  current: string;
  onSelect: (path: string) => void;
  /** Se presente, le cartelle accettano il drop di elementi */
  onDropItems?: (items: DragItem[], destDir: string) => void;
  rootLabel?: string;
};

/** Albero delle sole cartelle. Lo stato (espanse, corrente) è gestito dal chiamante. */
export function FolderTree(props: Props) {
  return (
    <ul className="tree" role="tree">
      <FolderNode {...props} path="" name={props.rootLabel ?? "Libreria"} depth={0} />
    </ul>
  );
}

function FolderNode(props: Props & { path: string; name: string; depth: number }) {
  const { fileTree, expanded, onToggle, current, onSelect, onDropItems, path, name, depth } = props;
  const [dropping, setDropping] = useState(false);
  const children = fileTree[path];
  const subdirs = children?.filter(c => c.type === "directory") ?? [];
  const isOpen = expanded.has(path);
  const hasChevron = children == null || subdirs.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasChevron ? isOpen : undefined} aria-selected={current === path}>
      <div
        className={`tree-row${current === path ? " active" : ""}${dropping ? " drop-target" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(path)}
        onDragOver={onDropItems ? e => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropping(true);
        } : undefined}
        onDragLeave={() => setDropping(false)}
        onDrop={onDropItems ? e => {
          e.preventDefault();
          setDropping(false);
          const raw = e.dataTransfer.getData(DRAG_MIME);
          if (raw) onDropItems(JSON.parse(raw), path);
        } : undefined}
        title={path || name}
      >
        <button
          className="chevron"
          style={{ visibility: hasChevron ? "visible" : "hidden" }}
          onClick={e => { e.stopPropagation(); onToggle(path); }}
          aria-label={isOpen ? "Comprimi" : "Espandi"}
          tabIndex={-1}
        >
          {isOpen ? "▾" : "▸"}
        </button>
        <span className="tree-icon">{isOpen ? "📂" : "📁"}</span>
        <span className="tree-name">{name}</span>
      </div>
      {isOpen && children == null && <div className="tree-loading" style={{ paddingLeft: 26 + depth * 14 }}>caricamento…</div>}
      {isOpen && subdirs.length > 0 && (
        <ul role="group">
          {subdirs.map(d => (
            <FolderNode key={d.name} {...props} path={joinPath(path, d.name)} name={d.name} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
