"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ enabled: boolean; firstUser: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/signup').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError('Le due password non coincidono');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registrazione non riuscita');
        return;
      }
      router.push('/login');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null; // evita di mostrare il form prima di sapere se la registrazione è aperta

  if (!status.enabled) {
    return (
      <main className="auth-page">
        <div className="card auth-card">
          <h1>Registrazione chiusa</h1>
          <p>Gli account vengono creati da un amministratore. Se ti serve un accesso, chiedilo a chi gestisce il sito.</p>
          <Link href="/login" className="btn btn-block">Torna all&apos;accesso</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>{status.firstUser ? 'Primo amministratore' : 'Registrati'}</h1>
        {status.firstUser ? (
          <p className="notice">Non ci sono ancora utenti: questo account avrà tutti i permessi, compresa la gestione degli utenti.</p>
        ) : (
          <p className="muted small">Dopo la registrazione un amministratore dovrà abilitare il tuo account.</p>
        )}
        <label className="field">
          <span>Utente</span>
          <input autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>Password (almeno 8 caratteri)</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>Ripeti password</span>
          <input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Creazione…' : 'Crea account'}</button>
        <p className="muted small">Hai già un account? <Link href="/login">Accedi</Link></p>
      </form>
    </main>
  );
}
