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
      {info.tags && (
        <>
          <h4>Tag audio</h4>
          <pre style={{ background: '#eee', padding: 8 }}>{JSON.stringify(info.tags, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
