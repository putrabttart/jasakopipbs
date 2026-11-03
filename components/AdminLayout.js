'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from './Icons';

export default function AdminLayout({ children, title = 'Admin' }) {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const pw = sessionStorage.getItem('admin-auth');
    if (pw) {
      setAuthed(true);
    } else {
      router.replace('/admin/login');
    }
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <main className="min-h-screen bg-ink-50 grid place-items-center">
        <Icon.Spinner size={24} className="text-ink-400" />
      </main>
    );
  }

  if (!authed) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-white pb-28">
      <TopBar title={title} pathname={pathname} router={router} />
      <div className="max-w-lg mx-auto px-4 pt-4">{children}</div>
      <BottomNav pathname={pathname} />
    </main>
  );
}

function TopBar({ title, pathname, router }) {
  function logout() {
    if (confirm('Yakin keluar dari admin panel?')) {
      sessionStorage.removeItem('admin-auth');
      router.replace('/admin/login');
    }
  }

  // Get subtitle based on path
  const subtitle = pathname?.includes('/admin/orders')
    ? 'Kelola Pesanan'
    : pathname?.includes('/admin/settings')
    ? 'Pengaturan'
    : 'Beranda';

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/85 border-b border-ink-200">
      <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white border border-ink-200 grid place-items-center overflow-hidden shadow-sm">
              <img
                src="https://cdn.kopikenangan.com/image/new_home/kopi-kenangan-v2.png"
                alt="Kopi Kenangan"
                className="w-full h-full object-contain p-1"
              />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-bold leading-none">
              {subtitle}
            </p>
            <h1 className="text-sm font-bold text-ink-900 truncate leading-tight mt-0.5">
              {title}
            </h1>
          </div>
        </Link>

        <button
          onClick={logout}
          className="w-10 h-10 rounded-full hover:bg-red-50 grid place-items-center text-ink-500 hover:text-red-500 transition active:scale-95"
          aria-label="Logout"
          title="Logout"
        >
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}

function BottomNav({ pathname }) {
  const items = [
    { href: '/admin', label: 'Beranda', Ico: HomeIcon },
    { href: '/admin/orders', label: 'Pesanan', Ico: ReceiptFilledIcon },
    { href: '/admin/settings', label: 'Settings', Ico: SettingsIcon },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Backdrop blur effect */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-xl border-t border-ink-200" />

      <div className="relative max-w-lg mx-auto px-3 py-2">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname?.startsWith(item.href);
            const I = item.Ico;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-0.5 py-1.5 transition active:scale-90 relative"
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-ink-900 rounded-full" />
                )}
                <div
                  className={
                    'w-11 h-11 rounded-2xl grid place-items-center transition ' +
                    (active
                      ? 'bg-gradient-to-br from-ink-900 to-ink-800 text-white shadow-lg shadow-ink-900/20'
                      : 'bg-transparent text-ink-400')
                  }
                >
                  <I size={20} active={active} />
                </div>
                <span
                  className={
                    'text-[10px] font-bold transition ' +
                    (active ? 'text-ink-900' : 'text-ink-400')
                  }
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* Custom icons - filled style for active state */

function HomeIcon({ size = 20, active }) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 12L12 3L21 12V20C21 20.5523 20.5523 21 20 21H15V14H9V21H4C3.44772 21 3 20.5523 3 20V12Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 2L21 9.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9.5Z" />
      <path d="M9 21V12H15V21" />
    </svg>
  );
}

function ReceiptFilledIcon({ size = 20, active }) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 2C5.44772 2 5 2.44772 5 3V22L7.5 20.5L10 22L12 20.5L14 22L16.5 20.5L19 22V3C19 2.44772 18.5523 2 18 2H6ZM8 7H16V9H8V7ZM8 11H16V13H8V11ZM8 15H13V17H8V15Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3V22L7.5 20.5L10 22L12 20.5L14 22L16.5 20.5L19 22V3C19 2.44772 18.5523 2 18 2H6C5.44772 2 5 2.44772 5 3Z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function SettingsIcon({ size = 20, active }) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 6.5C13.66 6.5 15 7.84 15 9.5C15 11.16 13.66 12.5 12 12.5C10.34 12.5 9 11.16 9 9.5C9 7.84 10.34 6.5 12 6.5ZM12 13.5C14 13.5 18 14.5 18 16.5V18H6V16.5C6 14.5 10 13.5 12 13.5Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15A1.65 1.65 0 0 0 19.73 16.81L19.79 16.87A2 2 0 0 1 17 19.65L16.94 19.59A1.65 1.65 0 0 0 15.13 19.26A1.65 1.65 0 0 0 14.18 20.77L14.18 20.86A2 2 0 0 1 10.18 20.86L10.18 20.77A1.65 1.65 0 0 0 9.23 19.26A1.65 1.65 0 0 0 7.42 19.59L7.36 19.65A2 2 0 0 1 4.58 16.87L4.64 16.81A1.65 1.65 0 0 0 4.97 15A1.65 1.65 0 0 0 3.46 14.05L3.37 14.05A2 2 0 0 1 3.37 10.05L3.46 10.05A1.65 1.65 0 0 0 4.97 9.1A1.65 1.65 0 0 0 4.64 7.29L4.58 7.23A2 2 0 0 1 7.36 4.45L7.42 4.51A1.65 1.65 0 0 0 9.23 4.84A1.65 1.65 0 0 0 10.18 3.33L10.18 3.24A2 2 0 0 1 14.18 3.24L14.18 3.33A1.65 1.65 0 0 0 15.13 4.84A1.65 1.65 0 0 0 16.94 4.51L17 4.45A2 2 0 0 1 19.78 7.23L19.72 7.29A1.65 1.65 0 0 0 19.39 9.1A1.65 1.65 0 0 0 20.9 10.05L20.99 10.05A2 2 0 0 1 20.99 14.05L20.9 14.05A1.65 1.65 0 0 0 19.4 15Z" />
    </svg>
  );
}

function LogoutIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
