import { useState, useRef } from "react";
import type { SelectionSet, NodeSelection, Node } from "./types";
import { FileListItem } from "./FileListItem";

export function FolderTree({ path, name, selection, setSelection, fetchChildren, fileTree, onSelect, refreshKey, onRefresh }: {
  path: string;
  name: string;
  selection: SelectionSet;
  setSelection: (sel: SelectionSet) => void;
  fetchChildren: (path: string) => Promise<Node[]>;
  fileTree: Record<string, Node[] | null>;
  onSelect?: (checked: boolean) => void;
  refreshKey?: number;
  onRefresh?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const children = fileTree[path];

  const handleToggle = () => {
    if (!open && children == null) {
      setLoading(true);
      fetchChildren(path)
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    }
    setOpen((v) => !v);
  };

  const handleSelect = (checked: boolean) => {
    const newSel = new Set(selection);
    if (checked) {
      newSel.add({ path, type: "directory" });
    } else {
      Array.from(newSel).forEach(sel => {
        if (sel.path === path && sel.type === "directory") newSel.delete(sel);
      });
    }
    setSelection(newSel);
  };

  const isChecked = Array.from(selection).some(sel => sel.path === path && sel.type === "directory");

  // Stato per mostrare input upload solo su questa cartella
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler upload per questa cartella
  async function handleFolderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const data = new FormData();
    data.append("file", file);
    data.append("name", file.name);
    try {
      const res = await fetch(`/api/mp3/upload?dir=${encodeURIComponent(path)}`, {
        method: "POST",
        body: data
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload fallito");
      alert("Upload completato!");
      fetchChildren(path); // refresh
      onRefresh?.();
    } catch (err: any) {
      alert("Errore upload: " + String(err));
    }
    setShowUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <li>
      <input
        type="checkbox"
        style={{ marginRight: 4 }}
        checked={isChecked}
        disabled={loading}
        onChange={e => {
          handleSelect(e.target.checked);
        }}
      />
      <span style={{ cursor: "pointer" }} onClick={handleToggle}>
        {open ? "📂" : "📁"} <b>{name}</b>
      </span>
      {/* Pulsante Sposta qui */}
      {selection.size > 0 && (
          <button
            style={{ marginLeft: 8, fontSize: 13, padding: '2px 8px', borderRadius: 4, border: '1px solid #2d8f2d', background: '#eaffea', cursor: 'pointer', fontWeight: 600 }}
            title="Sposta qui gli elementi selezionati"
            onClick={async e => {
              e.stopPropagation();
              if (!window.confirm(`Spostare ${selection.size} elementi qui?`)) return;
              try {
                console.log("[UI] selection:", selection);
                const items = Array.from(selection).map(sel => {
                  const obj = { path: sel?.path ?? "", type: sel?.type ?? "" };
                  console.log("[UI] item serializzato:", obj);
                  return obj;
                });
                console.log("[UI] items inviati:", items);
                const res = await fetch("/api/mp3/move", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items, destDir: path })
                });
                const data = await res.json();
                if (!res.ok) {
                  alert("Errore spostamento: " + (data.error || "Impossibile spostare i file"));
                } else {
                  alert("Spostamento completato!");
                  setSelection(new Set());
                  fetchChildren(path); // aggiorna la cartella di destinazione
                }
              } catch (err) {
                alert("Errore di rete: " + String(err));
              }
            }}
          >
            Sposta qui
          </button>
      )}
      <button
        style={{ marginLeft: 8, fontSize: 13, padding: '2px 8px', borderRadius: 4, border: '1px solid #aaa', background: '#f5f5f5', cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); setShowUpload(v => !v); }}
        title="Carica file in questa cartella"
      >
        Upload
      </button>
      {showUpload && (
        <input
          type="file"
          ref={fileInputRef}
          style={{ marginLeft: 8 }}
          onChange={handleFolderUpload}
          onClick={e => e.stopPropagation()}
        />
      )}
      {loading && <span> (caricamento...)</span>}
      {error && <div style={{ color: "red" }}>Errore: {error}</div>}
      {open && children && (
        <ul style={{ listStyle: "none", paddingLeft: 16 }}>
          {children.map((child) =>
            child.type === "directory" ? (
              <FolderTree
                key={child.name}
                path={path ? path + "/" + child.name : child.name}
                name={child.name}
                selection={selection}
                setSelection={setSelection}
                fetchChildren={fetchChildren}
                fileTree={fileTree}
                refreshKey={refreshKey}
                onRefresh={onRefresh}
              />
            ) : (
              <FileListItem
                key={child.name}
                path={path ? path + "/" + child.name : child.name}
                name={child.name}
                refreshKey={refreshKey}
                onRefresh={onRefresh}
                selected={Array.from(selection).some(sel => sel.path === (path ? path + "/" + child.name : child.name) && sel.type === "file")}
                onSelect={(checked) => {
                  const filePath = path ? path + "/" + child.name : child.name;
                  const newSel = new Set(selection);
                  if (checked) newSel.add({ path: filePath, type: "file" });
                  else Array.from(newSel).forEach(sel => {
                    if (sel.path === filePath && sel.type === "file") newSel.delete(sel);
                  });
                  setSelection(newSel);
                }}
              />
            )
          )}
        </ul>
      )}
    </li>
  );
}
