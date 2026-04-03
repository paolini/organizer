import { useState } from "react";
import { FileInfo } from "./FileInfo";

export function FileListItem({ path, name, selected, onSelect, refreshKey }: {
  path: string;
  name: string;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  refreshKey?: number;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <li>
      <input
        type="checkbox"
        style={{ marginRight: 4 }}
        checked={selected}
        onChange={e => {
          console.log("[UI] FileListItem checkbox", { path, checked: e.target.checked });
          onSelect(e.target.checked);
        }}
      />
      <span
        role="img"
        aria-label="file"
        style={{ cursor: "pointer" }}
        onClick={() => setShowInfo(true)}
      >
        📄
      </span>{' '}{name}
      {showInfo && (
        <FileInfo path={path} name={name} onClose={() => setShowInfo(false)} refreshKey={refreshKey} />
      )}
    </li>
  );
}
