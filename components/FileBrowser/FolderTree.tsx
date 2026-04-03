import { useState, useRef } from "react";
import type { SelectionMap, Node } from "./types";
import { getAllFiles } from "./treeUtils";
import { FileListItem } from "./FileListItem";

export function FolderTree({ path, name, selection, setSelection, fetchChildren, fileTree, onSelect }: {
  path: string;
  name: string;
  selection: SelectionMap;
  setSelection: (sel: SelectionMap) => void;
  fetchChildren: (path: string) => Promise<Node[]>;
  fileTree: Record<string, Node[] | null>;
  onSelect: (checked: boolean) => void;
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

  async function fetchAllFilesRecursively(basePath: string): Promise<string[]> {
    let files: string[] = [];
    let children = fileTree[basePath];
    if (children === undefined) {
      children = await fetchChildren(basePath);
    }
    if (!children) return files;
    for (const n of children) {
      const p = basePath ? basePath + "/" + n.name : n.name;
      if (n.type === "file") {
        files.push(p);
      } else if (n.type === "directory") {
        const subFiles = await fetchAllFilesRecursively(p);
        files = files.concat(subFiles);
      }
    }
    return files;
  }

  const handleSelect = async (checked: boolean) => {
    setLoading(true);
    try {
      const allFiles = await fetchAllFilesRecursively(path);
      const newSel = new Set(selection);
      if (checked) {
        allFiles.forEach(f => newSel.add(f));
      } else {
        allFiles.forEach(f => newSel.delete(f));
      }
      setSelection(newSel);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  function getFolderState(nodes: Node[] | null | undefined, base: string): { checked: boolean, indeterminate: boolean } {
    const allFiles = getAllFiles(nodes, base, fileTree);
    const selectedCount = allFiles.filter(f => selection.has(f)).length;
    return {
      checked: allFiles.length > 0 && selectedCount === allFiles.length,
      indeterminate: selectedCount > 0 && selectedCount < allFiles.length
    };
  }

  const { checked: isChecked, indeterminate: isIndeterminate } = getFolderState(children, path);

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
        ref={el => { if (el) el.indeterminate = isIndeterminate; }}
        disabled={loading}
        onChange={e => {
          onSelect(e.target.checked);
          void handleSelect(e.target.checked);
        }}
      />
      <span style={{ cursor: "pointer" }} onClick={handleToggle}>
        {open ? "📂" : "📁"} <b>{name}</b>
      </span>
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
                onSelect={(checked) => {
                  const childPath = path ? path + "/" + child.name : child.name;
                  const allFiles = getAllFiles(fileTree[childPath], childPath, fileTree);
                  const newSel = new Set(selection);
                  if (checked) allFiles.forEach((f: string) => newSel.add(f));
                  else allFiles.forEach((f: string) => newSel.delete(f));
                  setSelection(newSel);
                }}
              />
            ) : (
              <FileListItem
                key={child.name}
                path={path ? path + "/" + child.name : child.name}
                name={child.name}
                selected={selection.has(path ? path + "/" + child.name : child.name)}
                onSelect={(checked) => {
                  const newSel = new Set(selection);
                  if (checked) newSel.add(path ? path + "/" + child.name : child.name);
                  else newSel.delete(path ? path + "/" + child.name : child.name);
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
