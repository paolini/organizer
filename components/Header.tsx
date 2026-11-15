"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

type Me = { id: number; username: string; permissions: string[] };

export default function Header({ version }: { version: string }) {
  const [user, setUser] = useState<Me | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (mounted) setUser(data?.user ?? null); })
      .catch(() => { if (mounted) setUser(null); });
    return () => { mounted = false };
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    router.push('/login');
  }

  const isAdmin = user?.permissions.includes('admin');
  const navClass = (href: string) => `nav-link${pathname === href ? ' active' : ''}`;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <Link href="/" className="brand">Organizer</Link>
        <span className="muted" style={{ fontSize: 12 }}>v{version}</span>
        {user && (
          <nav className="app-nav">
            <Link href="/" className={navClass('/')}>Libreria</Link>
            {isAdmin && <Link href="/users" className={navClass('/users')}>Utenti</Link>}
          </nav>
        )}
      </div>
      <div className="app-header-user">
        {user ? (
          <>
            <Link href="/account" className={navClass('/account')} title="Il mio account">👤 {user.username}</Link>
            <button className="btn btn-ghost" onClick={logout}>Esci</button>
          </>
        ) : (
          pathname !== '/login' && <Link href="/login" className="nav-link">Accedi</Link>
        )}
      </div>
    </header>
  );
}
