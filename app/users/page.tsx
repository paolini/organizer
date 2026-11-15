"use client";

import { useCallback, useEffect, useState } from "react";
import { ToastProvider, useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PERMISSION_KEYS, PERMISSION_LABELS, generatePassword } from "../../components/permissions";

type User = { id: number; username: string; permissions: string[] };

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || `Errore ${res.status}`), { status: res.status });
  return data as T;
}

export default function UsersPage() {
  return (
    <ToastProvider>
      <Users />
    </ToastProvider>
  );
}

function Users() {
  const notify = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let alive = true;
    api<{ users: User[]; me: number }>("/api/users")
      .then(data => {
        if (!alive) return;
        setUsers(data.users.sort((a, b) => a.username.localeCompare(b.username)));
        setMeId(data.me);
      })
      .catch(e => {
        if (!alive) return;
        const status = (e as { status?: number }).status;
        setForbidden(status === 401 ? "Devi accedere per vedere questa pagina." : status === 403 ? "Questa pagina è riservata agli amministratori." : (e as Error).message);
      });
    return () => { alive = false; };
  }, [reloadKey]);

  async function togglePermission(u: User, perm: string, on: boolean) {
    const permissions = on ? [...u.permissions, perm] : u.permissions.filter(p => p !== perm);
    // aggiornamento ottimistico, ripristinato se il server rifiuta
    setUsers(us => us?.map(x => x.id === u.id ? { ...x, permissions } : x) ?? null);
    try {
      await api(`/api/users/${u.id}`, "PATCH", { permissions });
    } catch (e) {
      notify("error", (e as Error).message);
      setUsers(us => us?.map(x => x.id === u.id ? u : x) ?? null);
    }
  }

  async function remove(u: User) {
    setDeleting(null);
    try {
      await api(`/api/users/${u.id}`, "DELETE");
      notify("success", `Utente “${u.username}” eliminato.`);
      load();
    } catch (e) {
      notify("error", (e as Error).message);
    }
  }

  if (forbidden) {
    return (
      <main className="page">
        <h1>Utenti</h1>
        <div className="card">
          <p>{forbidden}</p>
          {forbidden.startsWith("Devi") && <a className="btn" href="/login">Accedi</a>}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-title">
        <h1>Utenti</h1>
        {!creating && <button className="btn btn-primary" onClick={() => setCreating(true)}>＋ Nuovo utente</button>}
      </div>

      {creating && (
        <NewUserForm
          onCancel={() => setCreating(false)}
          onCreated={u => { setCreating(false); notify("success", `Utente “${u.username}” creato.`); load(); }}
        />
      )}

      <div className="card card-flush">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Utente</th>
                {PERMISSION_KEYS.map(p => <th key={p} className="center" title={PERMISSION_LABELS[p].description}>{PERMISSION_LABELS[p].label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {users == null && <tr><td colSpan={5} className="muted">Caricamento…</td></tr>}
              {users?.map(u => {
                const isMe = u.id === meId;
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.username}</b>
                      {isMe && <span className="chip">tu</span>}
                      {u.permissions.length === 0 && <span className="chip chip-warn" title="Non può fare nulla finché non riceve almeno la lettura">da abilitare</span>}
                    </td>
                    {PERMISSION_KEYS.map(p => {
                      const lockSelf = isMe && p === "admin";
                      return (
                        <td key={p} className="center">
                          <input
                            type="checkbox"
                            checked={u.permissions.includes(p)}
                            disabled={lockSelf}
                            title={lockSelf ? "Non puoi togliere a te stesso il permesso admin" : PERMISSION_LABELS[p].description}
                            aria-label={`${PERMISSION_LABELS[p].label} per ${u.username}`}
                            onChange={e => togglePermission(u, p, e.target.checked)}
                          />
                        </td>
                      );
                    })}
                    <td className="row-actions">
                      <button className="btn btn-small" onClick={() => setResetting(u)}>Reimposta password</button>
                      <button
                        className="btn btn-small btn-danger-outline"
                        onClick={() => setDeleting(u)}
                        disabled={isMe}
                        title={isMe ? "Non puoi eliminare il tuo account" : undefined}
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="legend muted small">
        {PERMISSION_KEYS.map(p => <li key={p}><b>{PERMISSION_LABELS[p].label}</b>: {PERMISSION_LABELS[p].description}</li>)}
      </ul>

      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          isMe={resetting.id === meId}
          onClose={() => setResetting(null)}
          onDone={() => notify("success", `Password di “${resetting.username}” reimpostata.`)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Eliminare l'utente “${deleting.username}”?`}
          confirmLabel="Elimina"
          danger
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>L&apos;utente non potrà più accedere. I file della libreria non vengono toccati.</p>
        </ConfirmDialog>
      )}
    </main>
  );
}

function PasswordInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <input
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
      />
      <button type="button" className="btn" onClick={() => setVisible(v => !v)}>{visible ? "Nascondi" : "Mostra"}</button>
      <button type="button" className="btn" onClick={() => { onChange(generatePassword()); setVisible(true); }}>Genera</button>
    </div>
  );
}

function NewUserForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["read"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await api<{ user: User }>("/api/users", "POST", { username, password, permissions });
      onCreated(user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Nuovo utente</h2>
      <label className="field">
        <span>Nome utente</span>
        <input value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="off" />
      </label>
      <label className="field">
        <span>Password (almeno 8 caratteri)</span>
        <PasswordInput value={password} onChange={setPassword} />
      </label>
      <fieldset className="field perms">
        <legend>Permessi</legend>
        {PERMISSION_KEYS.map(p => (
          <label key={p} className="check">
            <input
              type="checkbox"
              checked={permissions.includes(p)}
              onChange={e => setPermissions(ps => e.target.checked ? [...ps, p] : ps.filter(x => x !== p))}
            />
            <span><b>{PERMISSION_LABELS[p].label}</b> <span className="muted">{PERMISSION_LABELS[p].description}</span></span>
          </label>
        ))}
      </fieldset>
      <p className="hint">Comunica la password all&apos;utente: potrà cambiarla dalla pagina del suo account.</p>
      {error && <div className="form-error">{error}</div>}
      <div className="actions">
        <button className="btn" type="button" onClick={onCancel}>Annulla</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Creazione…" : "Crea utente"}</button>
      </div>
    </form>
  );
}

function ResetPasswordDialog({ user, isMe, onClose, onDone }: { user: User; isMe: boolean; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, "PATCH", { password });
      onDone();
      if (isMe) window.location.href = "/login"; // la propria sessione è stata chiusa
      else onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3 id="reset-title">Nuova password per “{user.username}”</h3>
        <div className="modal-body stack">
          <PasswordInput value={password} onChange={setPassword} autoFocus />
          <p className="hint">
            {isMe
              ? "Stai cambiando la tua password: dovrai accedere di nuovo."
              : "Le sessioni aperte dall'utente verranno chiuse. Comunicagli la nuova password."}
          </p>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-actions">
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" type="submit" disabled={busy || !password}>Imposta password</button>
        </div>
      </form>
    </div>
  );
}
