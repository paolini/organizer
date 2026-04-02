"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
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
    <header style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #ddd' }}>
      <div>Organizer</div>
      <div>
        {user ? (
          <>
            <span style={{ marginRight: 12 }}>Hello, {user}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <a href="/login" style={{ marginRight: 8 }}>Login</a>
            <a href="/signup">Signup</a>
          </>
        )}
      </div>
    </header>
  );
}
