"use client";
import { useRef } from "react";

type Props = {
  currentDir: string;
  onNavigate: (path: string) => void;
  selectedCount: number;
  flacCount: number;
  busy: boolean;
  onUpload: (files: FileList) => void;
  onMkdir: () => void;
  onMove: () => void;
  onConvert: () => void;
  onRefresh: () => void;
};

export function Toolbar(p: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const parts = p.currentDir ? p.currentDir.split("/") : [];

  return (
    <div className="pane-header">
      <nav className="breadcrumb" aria-label="Percorso">
        <button className="crumb" onClick={() => p.onNavigate("")}>Libreria</button>
        {parts.map((part, i) => (
          <span key={i}>
            <span className="crumb-sep">/</span>
            <button className="crumb" onClick={() => p.onNavigate(parts.slice(0, i + 1).join("/"))}>{part}</button>
          </span>
        ))}
      </nav>
      <div className="toolbar">
        <button className="btn" onClick={() => fileInput.current?.click()} disabled={p.busy} title="Carica file nella cartella corrente">
          ⬆ Carica
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={e => {
            if (e.target.files?.length) p.onUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <button className="btn" onClick={p.onMkdir} disabled={p.busy} title="Crea una sottocartella">
          ＋ Nuova cartella
        </button>
        <button className="btn" onClick={p.onMove} disabled={p.busy || p.selectedCount === 0} title="Sposta i selezionati in un'altra cartella (o trascinali sull'albero)">
          ➜ Sposta in…
        </button>
        {p.flacCount > 0 && (
          <button className="btn" onClick={p.onConvert} disabled={p.busy}>
            ⟳ Converti {p.flacCount} FLAC in MP3
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={p.onRefresh} disabled={p.busy} title="Ricarica">↻</button>
      </div>
    </div>
  );
}
