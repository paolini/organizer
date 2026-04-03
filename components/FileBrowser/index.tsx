"use client";

import { useEffect, useState, useCallback } from "react";
import type { SelectionMap, Node } from "./types";
import { getAllFiles } from "./treeUtils";
import { FolderTree } from "./FolderTree";
import { FileListItem } from "./FileListItem";

function FileBrowser() {
  const [fileTree, setFileTree] = useState<Record<string, Node[] | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionMap>(new Set());

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

  if (loading) return <div>Caricamento...</div>;
  if (error) return <div style={{ color: 'red' }}>Errore: {error}</div>;

  const root = fileTree[""];

  return (
    <div>
      <h2>File e cartelle disponibili</h2>
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
                onSelect={(checked) => {
                  const allFiles = getAllFiles(fileTree[node.name], node.name, fileTree);
                  const newSel = new Set(selection);
                  if (checked) allFiles.forEach((f: string) => newSel.add(f));
                  else allFiles.forEach((f: string) => newSel.delete(f));
                  setSelection(newSel);
                }}
              />
            ) : (
              <FileListItem
                key={node.name}
                path={node.name}
                name={node.name}
                selected={selection.has(node.name)}
                onSelect={(checked) => {
                  const newSel = new Set(selection);
                  if (checked) newSel.add(node.name);
                  else newSel.delete(node.name);
                  setSelection(newSel);
                }}
              />
            )
          )}
        </ul>
      ) : (
        <div>Nessun file trovato.</div>
      )}
      <div style={{marginTop:16}}>
        <b>Selezionati:</b>
        <pre>{JSON.stringify(Array.from(selection), null, 2)}</pre>
      </div>
    </div>
  );
}

export default FileBrowser;
