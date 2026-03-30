"use client";

import { useEffect, useState } from "react";

type Node = {
  name: string;
  type: "file" | "directory";
};

function FolderTree({ path, name }: { path: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Node[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (!open && children === null) {
      setLoading(true);
      fetch(`/api/mp3?path=${encodeURIComponent(path)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.children) setChildren(data.children);
          else setError(data.error || "Errore sconosciuto");
        })
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    }
    setOpen((v) => !v);
  };

  return (
    <li>
      <span style={{ cursor: "pointer" }} onClick={handleToggle}>
        {open ? "📂" : "📁"} <b>{name}</b>
      </span>
      {loading && <span> (caricamento...)</span>}
      {error && <div style={{ color: "red" }}>Errore: {error}</div>}
      {open && children && (
        <ul style={{ listStyle: "none", paddingLeft: 16 }}>
          {children.map((child) =>
            child.type === "directory" ? (
              <FolderTree key={child.name} path={path ? path + "/" + child.name : child.name} name={child.name} />
            ) : (
              <li key={child.name}><span role="img" aria-label="file">🎵</span> {child.name}</li>
            )
          )}
        </ul>
      )}
    </li>
  );
}

export default function FileBrowser() {
  const [root, setRoot] = useState<Node[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mp3")
      .then((res) => res.json())
      .then((data) => {
        if (data.children) setRoot(data.children);
        else setError(data.error || "Errore sconosciuto");
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Caricamento...</div>;
  if (error) return <div style={{ color: 'red' }}>Errore: {error}</div>;

  return (
    <div>
      <h2>File e cartelle disponibili</h2>
      {root && root.length > 0 ? (
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {root.map((node) =>
            node.type === "directory" ? (
              <FolderTree key={node.name} path={node.name} name={node.name} />
            ) : (
              <li key={node.name}><span role="img" aria-label="file">🎵</span> {node.name}</li>
            )
          )}
        </ul>
      ) : (
        <div>Nessun file trovato.</div>
      )}
    </div>
  );
}
