"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState<{ enabled: boolean; firstUser: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/signup').then(r => r.json()).then(setSignup).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Accesso non riuscito');
        return;
      }
      router.push('/');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Accedi</h1>
        {signup?.firstUser && (
          <p className="notice">Nessun utente configurato. <Link href="/signup">Crea il primo account amministratore</Link>.</p>
        )}
        <label className="field">
          <span>Utente</span>
          <input autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button>
        {signup?.enabled && !signup.firstUser && (
          <p className="muted small">Non hai un account? <Link href="/signup">Registrati</Link></p>
        )}
      </form>
    </main>
  );
}
