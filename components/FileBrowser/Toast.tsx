"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "info" | "success" | "error";
type Toast = { id: number; kind: Kind; text: string };
type Notify = (kind: Kind, text: string) => void;

const ToastContext = createContext<Notify>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const notify = useCallback<Notify>((kind, text) => {
    const id = nextId.current++;
    setToasts(ts => [...ts, { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === "error" ? 10000 : 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.text}</span>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Chiudi">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
