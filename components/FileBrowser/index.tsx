"use client";
import { FolderTree } from "./FolderTree";
import type { NodeSelection, SelectionSet, Node } from "./types";
import { getAllFiles } from "./treeUtils";
import { FileListItem } from "./FileListItem";
import GenreBulkEditor from "../GenreBulkEditor";
import React, { useState, useEffect, useCallback } from "react";
function FileBrowser() {
  // Tutti gli hook DEVONO essere chiamati sempre, subito all'inizio
  const [fileTree, setFileTree] = useState<Record<string, Node[] | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionSet>(new Set());
  const [currentDir, setCurrentDir] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Carica i figli di una cartella e aggiorna fileTree
  const fetchChildren = useCallback(async (path: string) => {
    const res = await fetch(`/api/mp3?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setFileTree(prev => ({ ...prev, [path]: data.children ?? [] }));
    return data.children ?? [];
  }, []);

  useEffect(() => {
    fetch("/api/mp3")
      .then((res) => res.json())
      .then((data) => {
        const rootChildren = data.children ?? [];
        const treeInit: Record<string, Node[] | null> = { "": rootChildren };
        for (const node of rootChildren) {
          if (node.type === "directory") treeInit[node.name] = null;
        }
        setFileTree(prev => ({ ...prev, ...treeInit }));
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  // Aggiorna currentDir quando si naviga (solo root qui, FolderTree può essere esteso per sottocartelle)
  useEffect(() => { setCurrentDir(""); }, []);

  // Upload handler
  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    if (!fileInput?.files?.length) return alert("Seleziona un file da caricare");
    const file = fileInput.files[0];
    const data = new FormData();
    data.append("file", file);
    data.append("name", file.name);
    try {
      const res = await fetch(`/api/mp3/upload?dir=${encodeURIComponent(currentDir)}`, {

        method: "POST",
        body: data
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload fallito");
      alert("Upload completato!");
      // Refresh fileTree
      fetchChildren(currentDir);
    } catch (err: any) {
      alert("Errore upload: " + String(err));
    }
    fileInput.value = "";
  }

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    // Also refresh the current directory tree
    fetchChildren(currentDir);
  }, [fetchChildren, currentDir]);

  const root = fileTree[""];

  return (
    <div>
      <h2>File e cartelle disponibili</h2>
      {/* Upload globale rimosso: ora solo per-folder */}
      {root && root.length > 0 ? (
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {root.map((node) =>
            node.type === "directory" ? (
              <FolderTree
                key={node.name}
                path={node.name}
                name={node.name}
                selection={selection}
                setSelection={setSelection}
                fetchChildren={fetchChildren}
                fileTree={fileTree}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
              />
            ) : (
              <FileListItem
                key={node.name}
                path={node.name}
                name={node.name}
                refreshKey={refreshKey}
                onRefresh={handleRefresh}
                selected={Array.from(selection).some(sel => sel.path === node.name && sel.type === "file")}
                onSelect={(checked) => {
                  const newSel = new Set(selection);
                  if (checked) newSel.add({ path: node.name, type: "file" });
                  else Array.from(newSel).forEach(sel => {
                    if (sel.path === node.name && sel.type === "file") newSel.delete(sel);
                  });
                  setSelection(newSel);
                }}
              />
            )
          )}
        </ul>
      ) : (
        <div>Nessun file trovato.</div>
      )}
      {selection.size > 0 && (
        <>
          <GenreBulkEditor
            selectedCount={selection.size}
            onApply={async genres => {
              const items = Array.from(selection).map(sel => ({ path: sel.path, type: sel.type }));
              // Concatena sempre in una stringa separata da ;
              const genreString = Array.isArray(genres) ? genres.join('; ') : String(genres);
              try {
                const res = await fetch("/api/mp3/bulk-genre", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items, genre: genreString })
                });
                const data = await res.json();
                if (!res.ok) {
                  console.error("Errore API bulk-genre:", data);
                  alert("Errore: " + (data.error || "Impossibile aggiornare i generi"));
                } else {
                  const failed = data.results.filter((r: any) => !r.ok);
                  if (failed.length === 0) {
                    alert("Genere aggiornato su tutti i file selezionati.");
                  setRefreshKey(k => k + 1);
                  } else {
                    console.error("Alcuni file non aggiornati:", failed);
                    alert(`Alcuni file non aggiornati:\n` + failed.map((r: any) => r.file + ": " + r.error).join("\n"));
                  }
                }
              } catch (e: any) {
                console.error("Errore di rete bulk-genre:", e);
                alert("Errore di rete: " + String(e));
              }
            }}
          />
          {/* Pulsante conversione FLAC->MP3 */}
          <ConvertFlacToMp3Button selection={selection} onRefresh={handleRefresh} />
        </>
      )}
      <div style={{marginTop:16}}>
        <b>Selezionati:</b>
        <pre>{JSON.stringify(Array.from(selection), null, 2)}</pre>
      </div>
    </div>
  );
}


export default FileBrowser;

// Pulsante per la conversione multipla FLAC->MP3
function ConvertFlacToMp3Button({ selection, onRefresh }: { selection: SelectionSet; onRefresh?: () => void }) {
  const flacFiles = Array.from(selection).filter(sel => sel.path.toLowerCase().endsWith('.flac')).map(sel => sel.path);
  const [loading, setLoading] = React.useState(false);
  if (flacFiles.length === 0) return null;
  return (
    <button
      style={{ marginTop: 12, background: '#2d8f2d', color: 'white', padding: '8px 18px', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/mp3/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: flacFiles })
          });
          const data = await res.json();
          if (!res.ok) {
            alert('Errore conversione: ' + (data.error || 'Impossibile convertire i file.'));
          } else {
            const failed = data.results?.filter((r: any) => !r.ok) || [];
            if (failed.length === 0) {
              alert('Conversione completata! Tutti i file FLAC selezionati sono stati convertiti in MP3.');
              onRefresh?.();
            } else {
              alert('Alcuni file non sono stati convertiti:\n' + failed.map((r: any) => r.file + ': ' + r.error).join('\n'));
            }
          }
        } catch (e: any) {
          alert('Errore di rete: ' + String(e));
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? 'Conversione in corso...' : `Converti ${flacFiles.length} FLAC in MP3`}
    </button>
  );
}
