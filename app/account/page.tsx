"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_LABELS } from "../../components/permissions";

type Me = { id: number; username: string; permissions: string[] };

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/login');
      else setMe(d.user);
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== next2) {
      setError('Le due password nuove non coincidono');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Cambio password non riuscito');
        return;
      }
      setSuccess(true);
      setCurrent(""); setNext(""); setNext2("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  return (
    <main className="page">
      <h1>Il mio account</h1>
      <section className="card">
        <dl className="props">
          <dt>Utente</dt><dd>{me.username}</dd>
          <dt>Permessi</dt>
          <dd>
            {me.permissions.length
              ? me.permissions.map(p => <span key={p} className="chip">{PERMISSION_LABELS[p]?.label ?? p}</span>)
              : <span className="muted">nessuno: chiedi a un amministratore di abilitare il tuo account</span>}
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>Cambia password</h2>
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Password attuale</span>
            <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span>Nuova password (almeno 8 caratteri)</span>
            <input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span>Ripeti la nuova password</span>
            <input type="password" autoComplete="new-password" value={next2} onChange={e => setNext2(e.target.value)} />
          </label>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">Password cambiata. Le altre sessioni aperte sono state chiuse.</div>}
          <div><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Salvataggio…' : 'Cambia password'}</button></div>
        </form>
      </section>
    </main>
  );
}
