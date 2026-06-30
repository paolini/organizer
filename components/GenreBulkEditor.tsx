import React, { useState } from "react";

export type BulkTagPayload = {
  genre?: string;
  title?: string;
  artist?: string;
  album?: string;
};

interface GenreBulkEditorProps {
  selectedCount: number;
  onApply: (payload: BulkTagPayload) => void;
}

export default function GenreBulkEditor({ selectedCount, onApply }: GenreBulkEditorProps) {
  const [genreInput, setGenreInput] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    // Split by ; and trim each genre, then normalize to "A; B; C"
    const genres = genreInput
      .split(";")
      .map(g => g.trim())
      .filter(Boolean);

    const payload: BulkTagPayload = {
      genre: genres.length > 0 ? genres.join("; ") : undefined,
      title: title.trim() || undefined,
      artist: artist.trim() || undefined,
      album: album.trim() || undefined,
    };

    if (!payload.genre && !payload.title && !payload.artist && !payload.album) {
      setError("Inserisci almeno un campo: genere, titolo, artista o album.");
      return;
    }

    setError(null);
    onApply(payload);
  }

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, maxWidth: 460 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>{selectedCount}</strong> file selezionati
      </div>
      <label htmlFor="genre-input" style={{ display: "block", marginBottom: 4 }}>
        Generi (separa con <code>;</code>):
      </label>
      <input
        id="genre-input"
        type="text"
        value={genreInput}
        onChange={e => setGenreInput(e.target.value)}
        placeholder="Es: Rock; Pop; Jazz"
        style={{ width: "100%", marginBottom: 8, padding: 6 }}
      />
      <label htmlFor="title-input" style={{ display: "block", marginBottom: 4 }}>
        Titolo:
      </label>
      <input
        id="title-input"
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Es: Summer On A Solitary Beach"
        style={{ width: "100%", marginBottom: 8, padding: 6 }}
      />
      <label htmlFor="artist-input" style={{ display: "block", marginBottom: 4 }}>
        Artista:
      </label>
      <input
        id="artist-input"
        type="text"
        value={artist}
        onChange={e => setArtist(e.target.value)}
        placeholder="Es: Franco Battiato"
        style={{ width: "100%", marginBottom: 8, padding: 6 }}
      />
      <label htmlFor="album-input" style={{ display: "block", marginBottom: 4 }}>
        Album:
      </label>
      <input
        id="album-input"
        type="text"
        value={album}
        onChange={e => setAlbum(e.target.value)}
        placeholder="Es: La Voce Del Padrone"
        style={{ width: "100%", marginBottom: 8, padding: 6 }}
      />
      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
      <button onClick={handleApply} disabled={selectedCount === 0}>
        Applica metadati a tutti
      </button>
    </div>
  );
}
