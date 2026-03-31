"use client";

import { useEffect, useState } from "react";

type Node = {
  name: string;
  type: "file" | "directory";
};

function FileInfo({ path, name, onClose }: { path: string; name: string; onClose: () => void }) {
  const [info, setInfo] = useState<any>(null);
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

function FileListItem({ path, name }: { path: string; name: string }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <li>
      <span
        role="img"
        aria-label="file"
        style={{ cursor: "pointer" }}
        onClick={() => setShowInfo(true)}
      >
        📄
      </span>{' '}{name}
      {showInfo && (
        <FileInfo path={path} name={name} onClose={() => setShowInfo(false)} />
      )}
    </li>
  );
}

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
              <FileListItem key={child.name} path={path ? path + "/" + child.name : child.name} name={child.name} />
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
              <FileListItem key={node.name} path={node.name} name={node.name} />
            )
          )}
        </ul>
      ) : (
        <div>Nessun file trovato.</div>
      )}
    </div>
  );
}
