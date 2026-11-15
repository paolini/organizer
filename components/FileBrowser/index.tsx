"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Entry, FileTree } from "./types";
import { ancestorsOf, joinPath, parentOf } from "./types";
import * as api from "./api";
import { FolderTree } from "./FolderTree";
import { FileTable } from "./FileTable";
import { Toolbar } from "./Toolbar";
import { DetailsPanel, type Run } from "./DetailsPanel";
import { MoveDialog } from "./MoveDialog";
import { Player } from "./Player";
import { TrashView } from "./TrashView";
import { kindOf } from "../../lib/fileTypes";
import { ToastProvider, useToast } from "../Toast";
import { movableTo, DRAG_MIME, type DragItem } from "./dnd";

type Tab = "tree" | "files" | "details";

const collator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

export default function FileBrowser() {
  return (
    <ToastProvider>
      <Browser />
    </ToastProvider>
  );
}

function Browser() {
  const notify = useToast();
  const [fileTree, setFileTree] = useState<FileTree>({});
  const [currentDir, setCurrentDir] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moving, setMoving] = useState<DragItem[] | null>(null);
  const [tab, setTab] = useState<Tab>("files");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [view, setView] = useState<"files" | "trash">("files");
  const [trashDrop, setTrashDrop] = useState(false);
  const [player, setPlayer] = useState<{ queue: Entry[]; index: number } | null>(null);
  const fileTreeRef = useRef(fileTree);
  fileTreeRef.current = fileTree;
  const currentDirRef = useRef(currentDir);
  currentDirRef.current = currentDir;

  const loadDir = useCallback(async (path: string) => {
    try {
      const children = await api.listDir(path);
      setFileTree(prev => ({ ...prev, [path]: children }));
      if (path === "") setLoadError(null);
    } catch (e) {
      const msg = (e as Error).message;
      if (path === "") setLoadError(msg);
      else notify("error", `Impossibile leggere /${path}: ${msg}`);
      setFileTree(prev => ({ ...prev, [path]: [] }));
    }
  }, [notify]);

  /** Ricarica tutte le cartelle già caricate e forza il refresh del pannello dettagli.
   *  Le cartelle che non esistono più (rinominate, spostate, eliminate) vengono
   *  tolte dalla cache senza segnalare errori. */
  const reloadAll = useCallback(async () => {
    const loaded = Object.keys(fileTreeRef.current).filter(k => k !== "" && fileTreeRef.current[k] != null);
    await Promise.all([
      loadDir(""),
      ...loaded.map(p => api.listDir(p)
        .then(children => setFileTree(prev => ({ ...prev, [p]: children })))
        .catch(() => {
          setFileTree(prev => {
            const next = { ...prev };
            delete next[p];
            return next;
          });
          // Se è sparita la cartella che stiamo guardando, risali al primo antenato esistente
          const cur = currentDirRef.current;
          if (cur === p || cur.startsWith(p + "/")) setCurrentDir(parentOf(p));
        })),
    ]);
    setRefreshKey(k => k + 1);
  }, [loadDir]);

  useEffect(() => { loadDir(""); }, [loadDir]);

  const entries: Entry[] | null = useMemo(() => {
    const nodes = fileTree[currentDir];
    if (!nodes) return null;
    return nodes
      .map(n => ({ ...n, path: joinPath(currentDir, n.name) }))
      .sort((a, b) => a.type !== b.type ? (a.type === "directory" ? -1 : 1) : collator.compare(a.name, b.name));
  }, [fileTree, currentDir]);

  // Tiene la selezione coerente con il contenuto della cartella (es. dopo uno spostamento)
  const selected = useMemo(() => (entries ?? []).filter(e => selection.has(e.path)), [entries, selection]);

  const navigate = useCallback((path: string) => {
    setView("files");
    setCurrentDir(path);
    setSelection(new Set());
    setExpanded(prev => {
      const next = new Set(prev);
      ancestorsOf(path).slice(0, -1).forEach(a => next.add(a));
      return next;
    });
    if (fileTreeRef.current[path] == null) loadDir(path);
    setTab("files");
  }, [loadDir]);

  const toggleExpanded = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else {
        next.add(path);
        if (fileTreeRef.current[path] == null) loadDir(path);
      }
      return next;
    });
  }, [loadDir]);

  const run: Run = useCallback(async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      notify("success", successMsg);
      return true;
    } catch (e) {
      notify("error", (e as Error).message || String(e));
      return false;
    } finally {
      setBusy(false);
      await reloadAll();
    }
  }, [notify, reloadAll]);

  async function moveItems(items: DragItem[], destDir: string) {
    setMoving(null);
    const ok = movableTo(items, destDir);
    if (ok.length === 0) return;
    const done = await run(() => api.moveItems(ok, destDir), `${ok.length} ${ok.length === 1 ? "elemento spostato" : "elementi spostati"} in /${destDir}`);
    if (done) setSelection(new Set());
  }

  async function rename(path: string, newName: string) {
    setRenaming(null);
    let newPath = path;
    const done = await run(async () => { newPath = await api.renameItem(path, newName); }, `Rinominato in “${newName}”.`);
    if (done) setSelection(new Set([newPath]));
  }

  /** Sposta nel cestino, senza conferma: la notifica offre "Annulla" */
  async function trashItems(items: DragItem[]) {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const ids = await api.deleteItems(items.map(e => ({ path: e.path, type: e.type })));
      setSelection(new Set());
      const what = items.length === 1 ? `“${items[0].path.split("/").pop()}”` : `${items.length} elementi`;
      notify("success", `${what} nel cestino.`, {
        label: "Annulla",
        onClick: () => run(() => api.restoreTrash(ids), items.length === 1 ? `${what} ripristinato.` : `${what} ripristinati.`),
      });
    } catch (e) {
      notify("error", (e as Error).message || String(e));
    } finally {
      setBusy(false);
      await reloadAll();
    }
  }
  const deleteSelected = () => trashItems(selected.map(e => ({ path: e.path, type: e.type })));

  function openTrash() {
    setView("trash");
    setSelection(new Set());
    setTab("files");
  }

  /** Avvia la riproduzione: la coda è l'elenco dei brani della cartella corrente */
  function play(entry: Entry) {
    const queue = (entries ?? []).filter(e => e.type === "file" && kindOf(e.name) === "audio");
    const index = queue.findIndex(e => e.path === entry.path);
    if (index >= 0) setPlayer({ queue, index });
  }
  const playingPath = player ? player.queue[player.index].path : null;
  const setPlayerIndex = useCallback((index: number) => setPlayer(p => p && { ...p, index }), []);
  const closePlayer = useCallback(() => setPlayer(null), []);

  async function mkdir() {
    const name = window.prompt("Nome della nuova cartella:")?.trim();
    if (!name) return;
    const done = await run(() => api.makeDir(currentDir, name), `Cartella “${name}” creata.`);
    if (done) setExpanded(prev => new Set(prev).add(currentDir));
  }

  function upload(files: FileList | File[]) {
    const n = Array.from(files).length;
    notify("info", `Caricamento di ${n} file in corso…`);
    run(async () => {
      const uploaded = await api.uploadFiles(currentDir, files);
      if (uploaded !== n) throw new Error(`Caricati ${uploaded} file su ${n}.`);
    }, `${n} file caricati.`);
  }

  const [fileDragOver, setFileDragOver] = useState(false);

  if (loadError && !fileTree[""]?.length) {
    return (
      <div className="fb-error">
        <p>Errore: {loadError}</p>
        <p>Se non sei autenticato <a href="/login">esegui il login</a>.</p>
      </div>
    );
  }

  return (
    <div className="fb-root" data-tab={tab}>
      <div className="fb-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "tree"} onClick={() => setTab("tree")}>Cartelle</button>
        <button role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")}>File</button>
        <button role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")}>
          Dettagli{selected.length ? ` (${selected.length})` : ""}
        </button>
      </div>

      <aside className="pane pane-tree">
        <FolderTree
          fileTree={fileTree}
          expanded={expanded}
          onToggle={toggleExpanded}
          current={currentDir}
          onSelect={navigate}
          onDropItems={moveItems}
          rootActive={view === "files"}
        />
        <div
          className={`tree-row trash-row${view === "trash" ? " active" : ""}${trashDrop ? " drop-target" : ""}`}
          onClick={openTrash}
          onDragOver={e => {
            if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
            e.preventDefault();
            setTrashDrop(true);
          }}
          onDragLeave={() => setTrashDrop(false)}
          onDrop={e => {
            e.preventDefault();
            setTrashDrop(false);
            const raw = e.dataTransfer.getData(DRAG_MIME);
            if (raw) trashItems(JSON.parse(raw));
          }}
          title="Cestino (trascina qui per eliminare)"
        >
          <span className="chevron" />
          <span className="tree-icon">🗑</span>
          <span className="tree-name">Cestino</span>
        </div>
      </aside>

      {view === "trash" ? (
        <TrashView busy={busy} run={run} refreshKey={refreshKey} onOpenFolder={navigate} />
      ) : (<>
      <section
        className={`pane pane-files${fileDragOver ? " os-drop" : ""}`}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setFileDragOver(true);
        }}
        onDragLeave={e => { if (e.currentTarget === e.target) setFileDragOver(false); }}
        onDrop={e => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setFileDragOver(false);
          upload(e.dataTransfer.files);
        }}
      >
        <Toolbar
          currentDir={currentDir}
          onNavigate={navigate}
          selectedCount={selected.length}
          busy={busy}
          onUpload={upload}
          onMkdir={mkdir}
          onMove={() => setMoving(selected.map(e => ({ path: e.path, type: e.type })))}
          onRename={() => selected.length === 1 && setRenaming(selected[0].path)}
          onDelete={deleteSelected}
          onRefresh={reloadAll}
        />
        <FileTable
          entries={entries}
          selection={selection}
          onSelectionChange={setSelection}
          onOpenFolder={navigate}
          onDropItems={moveItems}
          renaming={renaming}
          onRenameStart={setRenaming}
          onRenameSubmit={rename}
          onRenameCancel={() => setRenaming(null)}
          onDelete={deleteSelected}
          onPlay={play}
          playingPath={playingPath}
        />
        <div className="statusbar">
          {entries ? `${entries.length} elementi` : ""}
          {selected.length > 0 && ` · ${selected.length} selezionati`}
          {busy && " · operazione in corso…"}
        </div>
      </section>

      <aside className="pane pane-details">
        <DetailsPanel
          currentDir={currentDir}
          entries={entries}
          selected={selected}
          busy={busy}
          refreshKey={refreshKey}
          run={run}
          onOpenFolder={navigate}
          onPlay={play}
          playingPath={playingPath}
        />
      </aside>
      </>)}

      {player && (
        <Player queue={player.queue} index={player.index} onIndexChange={setPlayerIndex} onClose={closePlayer} />
      )}

      {moving && (
        <MoveDialog
          fileTree={fileTree}
          loadDir={loadDir}
          initialDir={currentDir}
          count={moving.length}
          onConfirm={dest => moveItems(moving, dest)}
          onCancel={() => setMoving(null)}
        />
      )}
    </div>
  );
}
