import React, { useState } from "react";

interface GenreBulkEditorProps {
  selectedCount: number;
  onApply: (genres: string[] | string) => void;
}

export default function GenreBulkEditor({ selectedCount, onApply }: GenreBulkEditorProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    // Split by ; and trim each genre
    const genres = input
      .split(";")
      .map(g => g.trim())
      .filter(Boolean);
    if (genres.length === 0) {
      setError("Inserisci almeno un genere.");
      return;
    }
    setError(null);
    onApply(genres);
  }

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, maxWidth: 400 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>{selectedCount}</strong> file selezionati
      </div>
      <label htmlFor="genre-input" style={{ display: "block", marginBottom: 4 }}>
        Generi (separa con <code>;</code>):
      </label>
      <input
        id="genre-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Es: Rock; Pop; Jazz"
        style={{ width: "100%", marginBottom: 8, padding: 6 }}
      />
      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
      <button onClick={handleApply} disabled={selectedCount === 0}>
        Applica a tutti
      </button>
    </div>
  );
}
