"use client";
import { useEffect, useState } from "react";
import type { Entry, FileInfoData } from "./types";
import * as api from "./api";
import { TagEditor, CoverUpload, type TagValues } from "./TagEditor";
import { kindOf, KIND_ICONS, extOf } from "../../lib/fileTypes";

export type Run = (fn: () => Promise<unknown>, successMsg: string) => Promise<boolean>;

type Props = {
  currentDir: string;
  entries: Entry[] | null;
  selected: Entry[];
  busy: boolean;
  refreshKey: number;
  run: Run;
  onOpenFolder: (path: string) => void;
  onPlay: (entry: Entry) => void;
  playingPath: string | null;
};

const isMp3 = (p: string) => p.toLowerCase().endsWith(".mp3");
const isFlac = (p: string) => p.toLowerCase().endsWith(".flac");

export function DetailsPanel(p: Props) {
  const { selected } = p;
  if (selected.length === 0) return <FolderSummary {...p} />;
  if (selected.length === 1 && selected[0].type === "file") {
    const entry = selected[0];
    switch (kindOf(entry.name)) {
      case "audio": return <AudioDetails key={entry.path} entry={entry} {...p} />;
      case "image": return <ImageDetails key={entry.path} entry={entry} {...p} />;
      case "text": return <TextDetails key={entry.path} entry={entry} {...p} />;
      default: return <OtherDetails key={entry.path} entry={entry} {...p} />;
    }
  }
  return <MultiDetails {...p} />;
}

function FolderSummary({ currentDir, entries }: Props) {
  const dirs = entries?.filter(e => e.type === "directory").length ?? 0;
  const files = entries?.filter(e => e.type === "file") ?? [];
  const audio = files.filter(e => kindOf(e.name) === "audio").length;
  return (
    <div className="details">
      <div className="details-head">
        <div className="big-icon">📂</div>
        <h3>{currentDir ? currentDir.split("/").pop() : "Libreria"}</h3>
        <div className="muted">
          {dirs} cartelle · {files.length} file{audio > 0 && audio < files.length ? ` (${audio} audio)` : ""}
        </div>
      </div>
      <p className="hint">
        Seleziona un file per vederne i dettagli, oppure più file (Ctrl/Shift + click) per modificarne i tag insieme.
        Doppio click su un brano per ascoltarlo. Puoi trascinare i file su una cartella dell&apos;albero per spostarli.
      </p>
    </div>
  );
}

/** Carica le info del file (dimensione, tag) e le ricarica dopo ogni operazione */
function useFileInfo(path: string, refreshKey: number) {
  const [info, setInfo] = useState<FileInfoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.fileInfo(path)
      .then(d => { if (alive) { setInfo(d); setError(null); } })
      .catch(e => { if (alive) setError(String(e.message ?? e)); });
    return () => { alive = false; };
  }, [path, refreshKey]);
  return { info, error };
}

function DownloadButton({ path }: { path: string }) {
  return <a className="btn" href={api.downloadUrl(path)} download>⬇ Scarica</a>;
}

function AudioDetails({ entry, busy, refreshKey, run, onPlay, playingPath }: Props & { entry: Entry }) {
  const { info, error } = useFileInfo(entry.path, refreshKey);

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
  const playing = playingPath === entry.path;

  return (
    <div className="details">
      <div className="details-head">
        {picture
          ? <img className="cover" src={`data:${picture.mime};base64,${picture.data}`} alt="copertina" />
          : <div className="cover cover-empty">🎵</div>}
        <h3 className="break">{common?.title || entry.name}</h3>
        {common?.artist && <div>{common.artist}{common.album ? ` — ${common.album}` : ""}</div>}
        {info && (
          <div className="muted">
            {info.ext.toUpperCase()} · {formatSize(info.size)}
            {info.tags?.format?.sampleRate ? ` · ${info.tags.format.sampleRate / 1000} kHz` : ""}
          </div>
        )}
        <div className="details-actions">
          <button className="btn btn-primary" onClick={() => onPlay(entry)} disabled={playing}>
            {playing ? "🔊 In riproduzione" : "▶ Ascolta"}
          </button>
          <DownloadButton path={entry.path} />
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

function ImageDetails({ entry, entries, busy, refreshKey, run }: Props & { entry: Entry }) {
  const { info } = useFileInfo(entry.path, refreshKey);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const src = api.downloadUrl(entry.path, true);
  // MP3 della stessa cartella: un'immagine come cover.jpg di solito è la copertina dell'album
  const siblingMp3s = (entries ?? []).filter(e => e.type === "file" && isMp3(e.name)).map(e => e.path);

  async function useAsCover() {
    const blob = await (await fetch(src)).blob();
    const file = new File([blob], entry.name, { type: blob.type });
    return api.uploadCover(siblingMp3s, file);
  }

  return (
    <div className="details">
      <div className="details-head">
        {failed ? (
          <div className="cover cover-empty">🖼️</div>
        ) : (
          <a href={src} target="_blank" rel="noopener noreferrer" title="Apri a dimensione piena">
            <img
              className="image-preview"
              src={`${src}&v=${refreshKey}`}
              alt={entry.name}
              onLoad={e => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
            />
          </a>
        )}
        <h3 className="break">{entry.name}</h3>
        <div className="muted">
          {extOf(entry.name).toUpperCase()}
          {info && ` · ${formatSize(info.size)}`}
          {dims && ` · ${dims.w} × ${dims.h} px`}
        </div>
        {failed && <div className="form-error">Il browser non riesce a mostrare questa immagine.</div>}
        <div className="details-actions">
          <DownloadButton path={entry.path} />
        </div>
      </div>
      {siblingMp3s.length > 0 && !failed && (
        <>
          <h4>Copertina</h4>
          <p className="hint">Incorpora questa immagine come copertina nei {siblingMp3s.length} file MP3 di questa cartella.</p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => run(useAsCover, `Copertina applicata a ${siblingMp3s.length} file.`)}
          >
            Usa come copertina
          </button>
        </>
      )}
    </div>
  );
}

function TextDetails({ entry, refreshKey }: Props & { entry: Entry }) {
  const { info } = useFileInfo(entry.path, refreshKey);
  const [preview, setPreview] = useState<api.TextPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.readTextPreview(entry.path)
      .then(p => { if (alive) setPreview(p); })
      .catch(e => { if (alive) setError(String(e.message ?? e)); });
    return () => { alive = false; };
  }, [entry.path, refreshKey]);

  return (
    <div className="details details-text">
      <div className="details-head">
        <div className="big-icon">📄</div>
        <h3 className="break">{entry.name}</h3>
        <div className="muted">{extOf(entry.name).toUpperCase()}{info && ` · ${formatSize(info.size)}`}</div>
        <div className="details-actions">
          <a className="btn" href={api.downloadUrl(entry.path, true)} target="_blank" rel="noopener noreferrer">Apri</a>
          <DownloadButton path={entry.path} />
        </div>
      </div>
      {error && <div className="form-error">Errore: {error}</div>}
      {!preview && !error && <div className="muted">Caricamento…</div>}
      {preview && (
        <>
          <pre className="text-preview">{preview.text || <span className="muted">(file vuoto)</span>}</pre>
          {preview.truncated && <p className="hint">Anteprima limitata ai primi 256 KB: usa “Apri” per il file completo.</p>}
        </>
      )}
    </div>
  );
}

function OtherDetails({ entry, refreshKey }: Props & { entry: Entry }) {
  const { info } = useFileInfo(entry.path, refreshKey);
  return (
    <div className="details">
      <div className="details-head">
        <div className="big-icon">{KIND_ICONS.other}</div>
        <h3 className="break">{entry.name}</h3>
        <div className="muted">{extOf(entry.name).toUpperCase() || "file"}{info && ` · ${formatSize(info.size)}`}</div>
        <div className="details-actions">
          <DownloadButton path={entry.path} />
        </div>
      </div>
      <p className="hint">Anteprima non disponibile per questo tipo di file.</p>
    </div>
  );
}

function MultiDetails({ selected, busy, refreshKey, run, onOpenFolder }: Props) {
  const dirs = selected.filter(e => e.type === "directory");
  const files = selected.filter(e => e.type === "file");
  const audio = files.filter(e => kindOf(e.name) === "audio");
  const mp3s = audio.filter(e => isMp3(e.path)).map(e => e.path);
  const flacs = audio.filter(e => isFlac(e.path)).map(e => e.path);
  // I tag si scrivono solo sui file audio (il server ignora gli altri)
  const tagItems = [...dirs, ...audio].map(e => ({ path: e.path, type: e.type }));
  const single = selected.length === 1 ? selected[0] : null;
  const ignored = files.length - audio.length;

  return (
    <div className="details">
      <div className="details-head">
        <div className="big-icon">{single ? "📁" : "🗂"}</div>
        <h3 className="break">{single ? single.name : `${selected.length} elementi selezionati`}</h3>
        {!single && <div className="muted">{files.length} file · {dirs.length} cartelle</div>}
        {(single || flacs.length > 0) && (
          <div className="details-actions">
            {single && <button className="btn" onClick={() => onOpenFolder(single.path)}>Apri cartella</button>}
            {flacs.length > 0 && (
              <button className="btn" disabled={busy} onClick={() => run(() => api.convertToMp3(flacs), `${flacs.length} file convertiti in MP3.`)}>
                ⟳ Converti {flacs.length} FLAC in MP3
              </button>
            )}
          </div>
        )}
      </div>

      {tagItems.length > 0 ? (
        <>
          <h4>Modifica tag</h4>
          {dirs.length > 0 && (
            <p className="hint">Le modifiche si applicano a tutti i file audio contenuti nelle cartelle selezionate, sottocartelle comprese.</p>
          )}
          {ignored > 0 && <p className="hint">{ignored} file non audio verranno ignorati.</p>}
          <TagEditor
            key={`${tagItems.map(i => i.path).join("|")}#${refreshKey}`}
            hide={["title", "track"]}
            applyLabel={`Applica a ${single ? "tutta la cartella" : "tutti"}`}
            busy={busy}
            onApply={payload => run(() => api.writeTags(tagItems, payload), "Tag aggiornati su tutti gli elementi selezionati.")}
          />
        </>
      ) : (
        <p className="hint">Nessun file audio selezionato: puoi spostare, rinominare o eliminare i file dalla barra in alto.</p>
      )}

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
