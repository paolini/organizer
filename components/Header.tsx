"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function Header({ version }: { version: string }) {
  const [user, setUser] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data?.user?.username) setUser(data.user.username);
        else setUser(null);
      })
      .catch(() => { if (mounted) setUser(null); });
    return () => { mounted = false };
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    router.push('/login');
  }

  return (
    <header className="app-header">
      <div>
        <b>Organizer</b> <span className="muted" style={{ fontSize: 12 }}>v{version}</span>
      </div>
      <div className="app-header-user">
        {user ? (
          <>
            <span>{user}</span>
            <button className="btn btn-ghost" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <a href="/login">Login</a>
            <a href="/signup">Signup</a>
          </>
        )}
      </div>
    </header>
  );
}
