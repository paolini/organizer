"use client";
import { useRef, useState } from "react";
import type { Entry } from "./types";
import { DRAG_MIME, type DragItem } from "./dnd";

type Props = {
  entries: Entry[] | null;
  selection: Set<string>;
  onSelectionChange: (sel: Set<string>) => void;
  onOpenFolder: (path: string) => void;
  onDropItems: (items: DragItem[], destDir: string) => void;
};

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function FileTable({ entries, selection, onSelectionChange, onOpenFolder, onDropItems }: Props) {
  const anchor = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  if (entries == null) return <div className="empty">Caricamento…</div>;
  if (entries.length === 0) return <div className="empty">Cartella vuota. Trascina qui i file o usa “Carica”.</div>;

  const paths = entries.map(e => e.path);

  function clickRow(e: React.MouseEvent, index: number) {
    const path = paths[index];
    if (e.shiftKey && anchor.current != null) {
      const [a, b] = [anchor.current, index].sort((x, y) => x - y);
      const range = paths.slice(a, b + 1);
      const next = e.ctrlKey || e.metaKey ? new Set(selection) : new Set<string>();
      range.forEach(p => next.add(p));
      onSelectionChange(next);
      return;
    }
    anchor.current = index;
    if (e.ctrlKey || e.metaKey) {
      toggle(path);
    } else {
      onSelectionChange(new Set([path]));
    }
  }

  function toggle(path: string) {
    const next = new Set(selection);
    if (next.has(path)) next.delete(path); else next.add(path);
    onSelectionChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onSelectionChange(new Set(paths));
    } else if (e.key === "Escape") {
      onSelectionChange(new Set());
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const cur = anchor.current ?? -1;
      const next = Math.max(0, Math.min(paths.length - 1, cur + (e.key === "ArrowDown" ? 1 : -1)));
      anchor.current = next;
      onSelectionChange(new Set([paths[next]]));
      document.getElementById(rowId(paths[next]))?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && anchor.current != null) {
      const entry = entries![anchor.current];
      if (entry?.type === "directory") onOpenFolder(entry.path);
    }
  }

  function dragStart(e: React.DragEvent, entry: Entry) {
    // Se si trascina un elemento selezionato si spostano tutti i selezionati
    const dragged = selection.has(entry.path)
      ? entries!.filter(en => selection.has(en.path))
      : [entry];
    const items: DragItem[] = dragged.map(d => ({ path: d.path, type: d.type }));
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(items));
    e.dataTransfer.effectAllowed = "move";
  }

  const allSelected = paths.length > 0 && paths.every(p => selection.has(p));

  return (
    <div className="table-wrap" tabIndex={0} onKeyDown={onKeyDown}>
      <table className="file-table">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = !allSelected && selection.size > 0; }}
                onChange={() => onSelectionChange(allSelected ? new Set() : new Set(paths))}
                aria-label="Seleziona tutto"
              />
            </th>
            <th>Nome</th>
            <th className="col-ext">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const selected = selection.has(entry.path);
            const isDir = entry.type === "directory";
            return (
              <tr
                key={entry.path}
                id={rowId(entry.path)}
                className={`${selected ? "selected" : ""}${dropTarget === entry.path ? " drop-target" : ""}`}
                onClick={e => clickRow(e, i)}
                onDoubleClick={() => isDir && onOpenFolder(entry.path)}
                draggable
                onDragStart={e => dragStart(e, entry)}
                onDragOver={isDir ? e => {
                  if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                  e.preventDefault();
                  setDropTarget(entry.path);
                } : undefined}
                onDragLeave={isDir ? () => setDropTarget(null) : undefined}
                onDrop={isDir ? e => {
                  e.preventDefault();
                  setDropTarget(null);
                  const raw = e.dataTransfer.getData(DRAG_MIME);
                  if (raw) onDropItems(JSON.parse(raw), entry.path);
                } : undefined}
              >
                <td className="col-check" onClick={e => { e.stopPropagation(); anchor.current = i; toggle(entry.path); }}>
                  <input type="checkbox" checked={selected} readOnly tabIndex={-1} aria-label={`Seleziona ${entry.name}`} />
                </td>
                <td className="col-name">
                  <span className="row-icon">{isDir ? "📁" : "🎵"}</span>
                  {entry.name}
                </td>
                <td className="col-ext">{isDir ? "cartella" : extOf(entry.name)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function rowId(path: string) {
  return "row-" + encodeURIComponent(path);
}
