"use client";
import { useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { Run } from "./DetailsPanel";
import { ConfirmDialog } from "../ConfirmDialog";
import { kindOf, KIND_ICONS } from "../../lib/fileTypes";

type Props = {
  busy: boolean;
  run: Run;
  /** cambia dopo ogni operazione: ricarica l'elenco */
  refreshKey: number;
  /** apre nella libreria la cartella dell'elemento ripristinato */
  onOpenFolder: (path: string) => void;
};

const dateFmt = new Intl.DateTimeFormat("it", { dateStyle: "medium", timeStyle: "short" });

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function folderOf(p: string) {
  const i = p.lastIndexOf("/");
  return i < 0 ? "Libreria" : p.slice(0, i);
}

function iconOf(e: api.TrashEntry) {
  return e.type === "directory" ? "📁" : KIND_ICONS[kindOf(e.name)];
}

/** Vista del cestino: occupa il pannello centrale e quello dei dettagli */
export function TrashView({ busy, run, refreshKey, onOpenFolder }: Props) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.listTrash>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"selected" | "all" | null>(null);
  const anchor = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    api.listTrash()
      .then(d => {
        if (!alive) return;
        setData(d);
        setError(null);
        // tiene nella selezione solo ciò che esiste ancora
        setSelection(sel => new Set([...sel].filter(id => d.entries.some(e => e.id === id))));
      })
      .catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [refreshKey]);

  const entries = data?.entries ?? [];
  const selected = entries.filter(e => selection.has(e.id));
  const ids = entries.map(e => e.id);

  function click(e: React.MouseEvent, i: number) {
    const id = ids[i];
    if (e.shiftKey && anchor.current != null) {
      const [a, b] = [anchor.current, i].sort((x, y) => x - y);
      setSelection(new Set(ids.slice(a, b + 1)));
      return;
    }
    anchor.current = i;
    if (e.ctrlKey || e.metaKey) toggle(id);
    else setSelection(new Set([id]));
  }

  function toggle(id: string) {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelection(next);
  }

  function restore(list: api.TrashEntry[]) {
    run(
      () => api.restoreTrash(list.map(e => e.id)),
      list.length === 1 ? `“${list[0].name}” ripristinato in /${folderOf(list[0].originalPath)}.` : `${list.length} elementi ripristinati.`
    );
  }

  function purge(which: "selected" | "all") {
    setConfirm(null);
    const n = which === "all" ? entries.length : selected.length;
    run(
      () => api.purgeTrash(which === "all" ? "all" : selected.map(e => e.id)),
      which === "all" ? "Cestino svuotato." : `${n} ${n === 1 ? "elemento eliminato" : "elementi eliminati"} definitivamente.`
    );
  }

  const allSelected = entries.length > 0 && selected.length === entries.length;
  const totalSize = entries.reduce((s, e) => s + e.size, 0);
  const single = selected.length === 1 ? selected[0] : null;

  return (
    <>
      <section className="pane pane-files">
        <div className="pane-header">
          <nav className="breadcrumb"><span className="crumb crumb-static">🗑 Cestino</span></nav>
          <div className="toolbar">
            <button className="btn" disabled={busy || selected.length === 0} onClick={() => restore(selected)}>
              ↶ Ripristina
            </button>
            {data?.canPurge && (
              <>
                <button className="btn btn-danger-outline" disabled={busy || selected.length === 0} onClick={() => setConfirm("selected")}>
                  Elimina definitivamente
                </button>
                <button className="btn btn-danger-outline" disabled={busy || entries.length === 0} onClick={() => setConfirm("all")}>
                  Svuota cestino
                </button>
              </>
            )}
          </div>
        </div>

        {error && <div className="empty form-error">Errore: {error}</div>}
        {!data && !error && <div className="empty">Caricamento…</div>}
        {data && entries.length === 0 && <div className="empty">Il cestino è vuoto.</div>}
        {entries.length > 0 && (
          <div className="table-wrap" tabIndex={0} onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); setSelection(new Set(ids)); }
            else if (e.key === "Escape") setSelection(new Set());
          }}>
            <table className="file-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = !allSelected && selected.length > 0; }}
                      onChange={() => setSelection(allSelected ? new Set() : new Set(ids))}
                      aria-label="Seleziona tutto"
                    />
                  </th>
                  <th>Nome</th>
                  <th className="col-wide">Posizione originale</th>
                  <th className="col-date">Eliminato</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className={selection.has(e.id) ? "selected" : ""} onClick={ev => click(ev, i)} onDoubleClick={() => restore([e])} title="Doppio click per ripristinare">
                    <td className="col-check" onClick={ev => { ev.stopPropagation(); anchor.current = i; toggle(e.id); }}>
                      <input type="checkbox" checked={selection.has(e.id)} readOnly tabIndex={-1} aria-label={`Seleziona ${e.name}`} />
                    </td>
                    <td className="col-name"><span className="row-icon">{iconOf(e)}</span>{e.name}</td>
                    <td className="col-wide muted">/{folderOf(e.originalPath) === "Libreria" ? "" : folderOf(e.originalPath)}</td>
                    <td className="col-date muted">{dateFmt.format(e.deletedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="statusbar">
          {data && `${entries.length} elementi · ${formatSize(totalSize)}`}
          {data?.retentionDays ? ` · eliminati automaticamente dopo ${data.retentionDays} giorni` : ""}
        </div>
      </section>

      <aside className="pane pane-details">
        <div className="details">
          {single ? (
            <>
              <div className="details-head">
                <div className="big-icon">{iconOf(single)}</div>
                <h3 className="break">{single.name}</h3>
                <div className="muted">{formatSize(single.size)}</div>
              </div>
              <dl className="props trash-props">
                <dt>Era in</dt><dd className="break">/{single.originalPath.includes("/") ? folderOf(single.originalPath) : ""}</dd>
                <dt>Eliminato</dt><dd>{dateFmt.format(single.deletedAt)}</dd>
                <dt>Da</dt><dd>{single.deletedBy}</dd>
                {data?.retentionDays ? (
                  <>
                    <dt>Scade</dt>
                    <dd>{dateFmt.format(single.deletedAt + data.retentionDays * 24 * 3600 * 1000)}</dd>
                  </>
                ) : null}
              </dl>
              <div className="details-actions">
                <button className="btn btn-primary" disabled={busy} onClick={() => restore([single])}>↶ Ripristina</button>
                <button className="btn" onClick={() => onOpenFolder(folderOf(single.originalPath) === "Libreria" ? "" : folderOf(single.originalPath))}>
                  Vai alla cartella
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="details-head">
                <div className="big-icon">🗑</div>
                <h3>{selected.length ? `${selected.length} elementi selezionati` : "Cestino"}</h3>
                <div className="muted">{formatSize((selected.length ? selected : entries).reduce((s, e) => s + e.size, 0))}</div>
              </div>
              <p className="hint">
                Gli elementi eliminati restano qui{data?.retentionDays ? ` per ${data.retentionDays} giorni` : ""} e si possono ripristinare
                nella posizione originale. Se lì esiste già un file con lo stesso nome, quello ripristinato riceve un suffisso come “(2)”.
                {data && !data.canPurge && " Solo un amministratore può eliminarli definitivamente."}
              </p>
            </>
          )}
        </div>
      </aside>

      {confirm && (
        <ConfirmDialog
          title={confirm === "all" ? "Svuotare il cestino?" : `Eliminare definitivamente ${selected.length} ${selected.length === 1 ? "elemento" : "elementi"}?`}
          confirmLabel={confirm === "all" ? "Svuota cestino" : "Elimina definitivamente"}
          danger
          onConfirm={() => purge(confirm)}
          onCancel={() => setConfirm(null)}
        >
          <p>
            {confirm === "all"
              ? `Verranno eliminati ${entries.length} elementi (${formatSize(totalSize)}).`
              : `Occupano ${formatSize(selected.reduce((s, e) => s + e.size, 0))}.`}
          </p>
          <p className="warn">L&apos;operazione è definitiva e non può essere annullata.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
