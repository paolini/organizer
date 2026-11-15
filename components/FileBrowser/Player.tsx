"use client";
import { useEffect, useRef } from "react";
import type { Entry } from "./types";
import { downloadUrl } from "./api";

type Props = {
  queue: Entry[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
};

function title(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

/** Barra del player: resta montata mentre si naviga, così la musica non si interrompe.
 *  Suona la cartella da cui è partita, passando da sola al brano successivo. */
export function Player({ queue, index, onIndexChange, onClose }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const track = queue[index];
  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;
  const folder = track.path.includes("/") ? track.path.slice(0, track.path.lastIndexOf("/")) : "Libreria";

  // Media Session: tasti multimediali della tastiera e controlli del sistema operativo
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: title(track.name), album: folder });
    navigator.mediaSession.setActionHandler("previoustrack", hasPrev ? () => onIndexChange(index - 1) : null);
    navigator.mediaSession.setActionHandler("nexttrack", hasNext ? () => onIndexChange(index + 1) : null);
  }, [track, folder, index, hasPrev, hasNext, onIndexChange]);

  return (
    <div className="player" role="region" aria-label="Riproduzione">
      <div className="player-controls">
        <button className="icon-btn" onClick={() => onIndexChange(index - 1)} disabled={!hasPrev} aria-label="Brano precedente" title="Precedente">⏮</button>
        <button className="icon-btn" onClick={() => onIndexChange(index + 1)} disabled={!hasNext} aria-label="Brano successivo" title="Successivo">⏭</button>
      </div>
      <div className="player-info" title={track.path}>
        <div className="player-title">{title(track.name)}</div>
        <div className="player-sub">{folder} · {index + 1}/{queue.length}</div>
      </div>
      <audio
        key={track.path}
        ref={audio}
        src={downloadUrl(track.path, true)}
        controls
        autoPlay
        onEnded={() => hasNext && onIndexChange(index + 1)}
      />
      <button className="icon-btn" onClick={onClose} aria-label="Chiudi il player" title="Chiudi">×</button>
    </div>
  );
}
