"use client";
import { useEffect, useRef, useState } from "react";
import type { Entry } from "./types";
import { DRAG_MIME, type DragItem } from "./dnd";
import { kindOf, extOf, KIND_ICONS } from "../../lib/fileTypes";

type Props = {
  entries: Entry[] | null;
  selection: Set<string>;
  onSelectionChange: (sel: Set<string>) => void;
  onOpenFolder: (path: string) => void;
  onDropItems: (items: DragItem[], destDir: string) => void;
  /** Path dell'elemento in rinomina (input inline al posto del nome) */
  renaming: string | null;
  onRenameStart: (path: string) => void;
  onRenameSubmit: (path: string, newName: string) => void;
  onRenameCancel: () => void;
  onDelete: () => void;
  /** Riproduce un file audio (doppio click o Invio) */
  onPlay: (entry: Entry) => void;
  playingPath: string | null;
};

export function FileTable(props: Props) {
  const { entries, selection, onSelectionChange, onOpenFolder, onDropItems, renaming } = props;
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
    if (renaming) return; // i tasti vanno all'input di rinomina
    if (e.key === "F2" && selection.size === 1) {
      e.preventDefault();
      props.onRenameStart([...selection][0]);
      return;
    }
    if (e.key === "Delete" && selection.size > 0) {
      e.preventDefault();
      props.onDelete();
      return;
    }
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
      else if (entry && kindOf(entry.name) === "audio") props.onPlay(entry);
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
            const kind = isDir ? null : kindOf(entry.name);
            const playing = props.playingPath === entry.path;
            return (
              <tr
                key={entry.path}
                id={rowId(entry.path)}
                className={`${selected ? "selected" : ""}${dropTarget === entry.path ? " drop-target" : ""}${playing ? " playing" : ""}`}
                onClick={e => clickRow(e, i)}
                onDoubleClick={() => {
                  if (isDir) onOpenFolder(entry.path);
                  else if (kind === "audio") props.onPlay(entry);
                }}
                draggable={renaming !== entry.path}
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
                  <span className="row-icon" title={playing ? "In riproduzione" : undefined}>
                    {isDir ? "📁" : playing ? "🔊" : KIND_ICONS[kind!]}
                  </span>
                  {renaming === entry.path ? (
                    <RenameInput
                      name={entry.name}
                      isDir={isDir}
                      onSubmit={newName => props.onRenameSubmit(entry.path, newName)}
                      onCancel={props.onRenameCancel}
                    />
                  ) : entry.name}
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

function RenameInput({ name, isDir, onSubmit, onCancel }: {
  name: string;
  isDir: boolean;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Per i file seleziona il nome senza estensione, come nei file manager
    const dot = name.lastIndexOf(".");
    el.setSelectionRange(0, !isDir && dot > 0 ? dot : name.length);
  }, [name, isDir]);

  function finish(commit: boolean) {
    if (done.current) return;
    done.current = true;
    const v = ref.current?.value.trim() ?? "";
    if (commit && v && v !== name) onSubmit(v);
    else onCancel();
  }

  return (
    <input
      ref={ref}
      className="rename-input"
      defaultValue={name}
      aria-label="Nuovo nome"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}
