import { useEffect, useState } from "react";
import type { FileInfoData } from "./types";

export function FileInfo({ path, name, onClose }: { path: string; name: string; onClose: () => void }) {
  const [info, setInfo] = useState<FileInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/mp3/fileinfo?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [path]);

  if (loading) return <div>Caricamento info...</div>;
  if (error) return <div style={{ color: 'red' }}>Errore: {error}</div>;
  if (!info) return null;

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, margin: 8, background: '#fafafa' }}>
      <button onClick={onClose} style={{ float: 'right' }}>Chiudi</button>
      <h3>Info file: {name}</h3>
      <ul>
        <li>Dimensione: {info.size} bytes</li>
        <li>Formato: {info.ext}</li>
      </ul>
      {info.ext === "flac" && (
        <button
          style={{ marginBottom: 8, background: '#2d8f2d', color: 'white', padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          onClick={async () => {
            try {
              const res = await fetch('/api/mp3/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
              });
              const data = await res.json();
              if (!res.ok) {
                alert('Errore conversione: ' + (data.error || 'Impossibile convertire il file.'));
              } else {
                alert('Conversione completata! File MP3 generato.');
              }
            } catch (e: any) {
              alert('Errore di rete: ' + String(e));
            }
          }}
        >
          Converti in MP3
        </button>
      )}
      {info.tags && (
        <>
          <h4>Tag audio</h4>
          <pre style={{ background: '#eee', padding: 8 }}>{JSON.stringify(info.tags, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
