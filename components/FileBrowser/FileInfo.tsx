import { useEffect, useState } from "react";
import type { FileInfoData } from "./types";

export function FileInfo({ path, name, onClose, refreshKey, onRefresh }: { path: string; name: string; onClose: () => void; refreshKey?: number; onRefresh?: () => void }) {
  const [info, setInfo] = useState<FileInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/mp3/fileinfo?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [path, refreshKey]);

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
        <li>
          <a
            href={`/api/mp3/download?path=${encodeURIComponent(path)}`}
            style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 500 }}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            Scarica file
          </a>
        </li>
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
                onRefresh?.();
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
          {(() => {
            // Avoid printing large base64 image data in the JSON preview
            try {
              const safe = { ...info.tags } as any;
              if (safe.pictures && Array.isArray(safe.pictures)) {
                safe.pictures = safe.pictures.map((p: any) => ({ mime: p.mime, description: p.description, size: p.size }));
              }
              return <pre style={{ background: '#eee', padding: 8 }}>{JSON.stringify(safe, null, 2)}</pre>;
            } catch (e) {
              return <pre style={{ background: '#eee', padding: 8 }}>Unable to render tags</pre>;
            }
          })()}
          {Array.isArray(info.tags.pictures) && info.tags.pictures.length > 0 && info.tags.pictures[0].data && (
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 8 }}>Copertina incorporata:</div>
              <img
                src={`data:${info.tags.pictures[0].mime};base64,${info.tags.pictures[0].data}`}
                alt="copertina"
                style={{ maxWidth: 240, display: 'block', marginBottom: 8 }}
              />
              
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Carica copertina (MP3):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setSelectedImage(f);
                if (f) setPreviewUrl(URL.createObjectURL(f));
                else setPreviewUrl(null);
              }}
            />
            {previewUrl && (
              <div style={{ marginTop: 8 }}>
                <img src={previewUrl} alt="preview" style={{ maxWidth: 200, display: 'block', marginBottom: 8 }} />
              </div>
            )}
            <button
              onClick={async () => {
                if (!selectedImage) return alert("Seleziona un'immagine prima");
                try {
                  const fd = new FormData();
                  fd.append('path', path);
                  fd.append('image', selectedImage);
                  const res = await fetch('/api/mp3/cover', { method: 'POST', body: fd });
                  const data = await res.json();
                  if (!res.ok) alert('Errore upload cover: ' + (data.error || 'unknown'));
                  else {
                    alert('Copertina aggiornata');
                    setSelectedImage(null);
                    setPreviewUrl(null);
                    onRefresh?.();
                  }
                } catch (e: any) {
                  alert('Errore di rete: ' + String(e));
                }
              }}
              style={{ marginTop: 8 }}
            >
              Carica copertina
            </button>
          </div>
        </>
      )}
    </div>
  );
}
