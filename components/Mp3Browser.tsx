"use client";
import { useEffect, useState } from "react";

type TreeNode = {
  name: string;
  type: "file" | "directory";
  children?: TreeNode[];
};

function FolderTree({ nodes }: { nodes: TreeNode[] }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", paddingLeft: 16 }}>
      {nodes.map((node) => (
        <li key={node.name}>
          {node.type === "directory" ? (
            <>
              <span role="img" aria-label="folder">📁</span> <b>{node.name}</b>
              {node.children && <FolderTree nodes={node.children} />}
            </>
          ) : (
            <span><span role="img" aria-label="file">🎵</span> {node.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Mp3Browser() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mp3")
      .then((res) => res.json())
      .then((data) => {
        if (data.tree) setTree(data.tree);
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
      {tree.length === 0 ? (
        <div>Nessun file trovato.</div>
      ) : (
        <FolderTree nodes={tree} />
      )}
    </div>
  );
}
