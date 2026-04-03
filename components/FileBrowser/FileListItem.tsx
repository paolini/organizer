import { useState } from "react";
import { FileInfo } from "./FileInfo";

export function FileListItem({ path, name, selected, onSelect }: {
  path: string;
  name: string;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <li>
      <input
        type="checkbox"
        style={{ marginRight: 4 }}
        checked={selected}
        onChange={e => onSelect(e.target.checked)}
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
        <FileInfo path={path} name={name} onClose={() => setShowInfo(false)} />
      )}
    </li>
  );
}
