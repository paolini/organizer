"use client";
import { useState } from "react";
import type { TagPayload } from "./api";

export type TagValues = {
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  year: string;
  track: string;
  genre: string;
};

const EMPTY: TagValues = { title: "", artist: "", albumArtist: "", album: "", year: "", track: "", genre: "" };

const FIELDS: { key: keyof TagValues; label: string; placeholder?: string; type?: string; half?: boolean }[] = [
  { key: "title", label: "Titolo" },
  { key: "artist", label: "Artista" },
  { key: "albumArtist", label: "Artista dell'album" },
  { key: "album", label: "Album" },
  { key: "year", label: "Anno", half: true },
  { key: "track", label: "Traccia", type: "number", half: true },
  { key: "genre", label: "Generi", placeholder: "Rock; Pop (separati da ;)" },
];

type Props = {
  initial?: Partial<TagValues>;
  /** Campi da nascondere (es. il titolo quando si modificano più file) */
  hide?: (keyof TagValues)[];
  applyLabel: string;
  busy: boolean;
  onApply: (payload: TagPayload) => unknown;
};

export function TagEditor({ initial, hide = [], applyLabel, busy, onApply }: Props) {
  const [values, setValues] = useState<TagValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof TagValues, v: string) {
    setValues(prev => ({ ...prev, [key]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const genres = values.genre.split(";").map(g => g.trim()).filter(Boolean);
    const payload: TagPayload = {
      genre: genres.length ? genres.join("; ") : undefined,
      title: values.title.trim() || undefined,
      artist: values.artist.trim() || undefined,
      album: values.album.trim() || undefined,
      year: values.year.trim() || undefined,
      track: values.track.trim() ? Number(values.track.trim()) : undefined,
      albumArtist: values.albumArtist.trim() || undefined,
    };
    if (Object.values(payload).every(v => v === undefined)) {
      setError("Compila almeno un campo.");
      return;
    }
    setError(null);
    onApply(payload);
  }

  return (
    <form className="tag-form" onSubmit={submit}>
      {FIELDS.filter(f => !hide.includes(f.key)).map(f => (
        <label key={f.key} className={f.half ? "half" : ""}>
          <span>{f.label}</span>
          <input
            type={f.type ?? "text"}
            min={f.type === "number" ? 1 : undefined}
            value={values[f.key]}
            placeholder={f.placeholder}
            onChange={e => set(f.key, e.target.value)}
          />
        </label>
      ))}
      <p className="hint">I campi lasciati vuoti non vengono modificati.</p>
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Salvataggio…" : applyLabel}</button>
    </form>
  );
}

export function CoverUpload({ busy, onUpload }: { busy: boolean; onUpload: (f: File) => Promise<boolean> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="cover-upload">
      <input
        type="file"
        accept="image/*"
        onChange={e => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (preview) URL.revokeObjectURL(preview);
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
      />
      {preview && <img src={preview} alt="anteprima copertina" className="cover-preview" />}
      {file && (
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            if (await onUpload(file)) {
              setFile(null);
              if (preview) URL.revokeObjectURL(preview);
              setPreview(null);
            }
          }}
        >
          Applica copertina
        </button>
      )}
    </div>
  );
}
