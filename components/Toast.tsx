"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "info" | "success" | "error";
export type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; kind: Kind; text: string; action?: ToastAction };
type Notify = (kind: Kind, text: string, action?: ToastAction) => void;

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

  const notify = useCallback<Notify>((kind, text, action) => {
    const id = nextId.current++;
    setToasts(ts => [...ts, { id, kind, text, action }]);
    // con un'azione (es. Annulla) la notifica resta più a lungo
    setTimeout(() => dismiss(id), kind === "error" ? 10000 : action ? 10000 : 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.text}</span>
            {t.action && (
              <button className="toast-action" onClick={() => { dismiss(t.id); t.action!.onClick(); }}>
                {t.action.label}
              </button>
            )}
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Chiudi">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
