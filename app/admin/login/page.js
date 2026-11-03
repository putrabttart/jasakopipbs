'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icons';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-auth');
    if (saved) router.replace('/admin');
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.error_code === 0) {
        sessionStorage.setItem('admin-auth', password);
        router.replace('/admin');
      } else {
        setError(json.msg || 'Password salah');
      }
    } catch (_) {
      setError('Gagal login');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white border border-ink-200 overflow-hidden shadow-card">
          <div className="bg-gradient-to-br from-ink-900 to-accent-700 p-6 text-center text-white">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/15 backdrop-blur grid place-items-center mb-3">
              <Icon.Lock size={28} />
            </div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs opacity-80 mt-1">Jasa Order Kopi Kenangan</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-900">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin"
                  className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-900 focus:bg-white transition"
                  autoFocus
                />
                {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-ink-900 text-white text-sm font-semibold py-3.5 rounded-2xl hover:bg-ink-800 active:scale-[.98] transition disabled:bg-ink-300 flex items-center justify-center gap-2"
              >
                {loading ? <Icon.Spinner size={14} /> : null}
                Masuk
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
