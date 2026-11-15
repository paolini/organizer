"use client";
import { useEffect, useState } from "react";
import type { Entry, FileInfoData } from "./types";
import * as api from "./api";
import { TagEditor, CoverUpload, type TagValues } from "./TagEditor";

export type Run = (fn: () => Promise<unknown>, successMsg: string) => Promise<boolean>;

type Props = {
  currentDir: string;
  entries: Entry[] | null;
  selected: Entry[];
  busy: boolean;
  refreshKey: number;
  run: Run;
  onOpenFolder: (path: string) => void;
};

const isMp3 = (p: string) => p.toLowerCase().endsWith(".mp3");
const isFlac = (p: string) => p.toLowerCase().endsWith(".flac");

export function DetailsPanel(p: Props) {
  const { selected } = p;
  if (selected.length === 0) return <FolderSummary {...p} />;
  if (selected.length === 1 && selected[0].type === "file") return <FileDetails key={selected[0].path} entry={selected[0]} {...p} />;
  return <MultiDetails {...p} />;
}

function FolderSummary({ currentDir, entries }: Props) {
  const dirs = entries?.filter(e => e.type === "directory").length ?? 0;
  const files = entries?.filter(e => e.type === "file").length ?? 0;
  return (
    <div className="details">
      <div className="details-head">
        <div className="big-icon">📂</div>
        <h3>{currentDir ? currentDir.split("/").pop() : "Libreria"}</h3>
        <div className="muted">{dirs} cartelle · {files} file</div>
      </div>
      <p className="hint">
        Seleziona un file per vederne i tag, oppure più file (Ctrl/Shift + click) per modificarli insieme.
        Puoi trascinare i file su una cartella dell&apos;albero per spostarli.
      </p>
    </div>
  );
}

function FileDetails({ entry, busy, refreshKey, run }: Props & { entry: Entry }) {
  const [info, setInfo] = useState<FileInfoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.fileInfo(entry.path)
      .then(d => { if (alive) { setInfo(d); setError(null); } })
      .catch(e => { if (alive) setError(String(e.message ?? e)); });
    return () => { alive = false; };
  }, [entry.path, refreshKey]);

  const common = info?.tags?.common;
  const picture = info?.tags?.pictures?.find(pic => pic.data);
  const initial: Partial<TagValues> | undefined = common && {
    title: common.title ?? "",
    artist: common.artist ?? "",
    albumArtist: common.albumArtist ?? "",
    album: common.album ?? "",
    year: common.year != null ? String(common.year) : "",
    track: common.track?.no != null ? String(common.track.no) : "",
    genre: (common.genre ?? []).join("; "),
  };
  const items = [{ path: entry.path, type: entry.type }];

  return (
    <div className="details">
      <div className="details-head">
        {picture
          ? <img className="cover" src={`data:${picture.mime};base64,${picture.data}`} alt="copertina" />
          : <div className="cover cover-empty">🎵</div>}
        <h3 className="break">{entry.name}</h3>
        {info && (
          <div className="muted">
            {info.ext.toUpperCase()} · {formatSize(info.size)}
            {info.tags?.format?.sampleRate ? ` · ${info.tags.format.sampleRate / 1000} kHz` : ""}
          </div>
        )}
        <div className="details-actions">
          <a className="btn" href={api.downloadUrl(entry.path)} download>⬇ Scarica</a>
          {isFlac(entry.path) && (
            <button className="btn" disabled={busy} onClick={() => run(() => api.convertToMp3([entry.path]), "Conversione completata: file MP3 generato.")}>
              ⟳ Converti in MP3
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">Errore: {error}</div>}
      {!info && !error && <div className="muted">Caricamento…</div>}
      {info?.tags?.error && <div className="form-error">{info.tags.error}</div>}

      {info && (
        <>
          <h4>Tag</h4>
          <TagEditor
            key={JSON.stringify(initial ?? {})} /* rimonta quando arrivano i tag riletti */
            initial={initial}
            applyLabel="Salva tag"
            busy={busy}
            onApply={payload => run(() => api.writeTags(items, payload), "Tag salvati.")}
          />
          {isMp3(entry.path) && (
            <>
              <h4>Copertina</h4>
              <CoverUpload
                key={refreshKey}
                busy={busy}
                onUpload={f => run(() => api.uploadCover([entry.path], f), "Copertina aggiornata.")}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function MultiDetails({ selected, busy, refreshKey, run, onOpenFolder }: Props) {
  const dirs = selected.filter(e => e.type === "directory");
  const files = selected.filter(e => e.type === "file");
  const mp3s = files.filter(e => isMp3(e.path)).map(e => e.path);
  const items = selected.map(e => ({ path: e.path, type: e.type }));
  const single = selected.length === 1 ? selected[0] : null;

  return (
    <div className="details">
      <div className="details-head">
        <div className="big-icon">{single ? "📁" : "🗂"}</div>
        <h3 className="break">{single ? single.name : `${selected.length} elementi selezionati`}</h3>
        {!single && <div className="muted">{files.length} file · {dirs.length} cartelle</div>}
        {single && (
          <div className="details-actions">
            <button className="btn" onClick={() => onOpenFolder(single.path)}>Apri cartella</button>
          </div>
        )}
      </div>

      <h4>Modifica tag</h4>
      {dirs.length > 0 && (
        <p className="hint">Le modifiche si applicano a tutti i file audio contenuti nelle cartelle selezionate, sottocartelle comprese.</p>
      )}
      <TagEditor
        key={`${items.map(i => i.path).join("|")}#${refreshKey}`}
        hide={["title", "track"]}
        applyLabel={`Applica a ${single ? "tutta la cartella" : "tutti"}`}
        busy={busy}
        onApply={payload => run(() => api.writeTags(items, payload), "Tag aggiornati su tutti gli elementi selezionati.")}
      />

      {mp3s.length > 0 && (
        <>
          <h4>Copertina</h4>
          <p className="hint">Verrà applicata ai {mp3s.length} file MP3 selezionati.</p>
          <CoverUpload
            key={refreshKey}
            busy={busy}
            onUpload={f => run(() => api.uploadCover(mp3s, f), `Copertina applicata a ${mp3s.length} file.`)}
          />
        </>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
