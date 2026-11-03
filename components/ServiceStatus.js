'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Icons';

const ServiceContext = createContext({ open: true, message: '' });

export function ServiceStatusProvider({ children }) {
  const [status, setStatus] = useState({ open: true, message: '' });

  useEffect(() => {
    let cancel = false;
    async function check() {
      try {
        const res = await fetch('/api/service-status', { cache: 'no-store' });
        const json = await res.json();
        if (!cancel && json.error_code === 0) {
          setStatus(json.data);
        }
      } catch (_) {
        // Default buka jika gagal fetch
      }
    }
    check();
    // Re-check setiap 30 detik
    const interval = setInterval(check, 30000);
    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <ServiceContext.Provider value={status}>{children}</ServiceContext.Provider>
  );
}

export function useServiceStatus() {
  return useContext(ServiceContext);
}

export function ServiceClosedBanner({ children }) {
  const { open, message } = useServiceStatus();
  const pathname = usePathname();

  // Jangan block halaman admin
  const isAdmin = pathname?.startsWith('/admin');

  if (!open && !isAdmin) {
    return <ClosedPage message={message} />;
  }

  return children || null;
}

function ClosedPage({ message }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-50 to-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-accent-100/40 blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-ink-200/30 blur-3xl" />
      </div>

      <div className="relative max-w-sm w-full text-center">
        {/* Animated coffee cup with steam */}
        <CoffeeCupAnimation />

        {/* Logo */}
        <div className="w-12 h-12 mx-auto rounded-xl bg-white border border-ink-200 overflow-hidden shadow-soft mb-4 mt-2">
          <img
            src="https://cdn.kopikenangan.com/image/new_home/kopi-kenangan-v2.png"
            alt="Kopi Kenangan"
            className="w-full h-full object-contain p-1.5"
          />
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-ink-900 tracking-tight">
          Sedang Istirahat
        </h1>
        <p className="text-sm md:text-base text-ink-600 mt-3 leading-relaxed max-w-xs mx-auto">
          {message || 'Layanan jasa order sedang tutup sementara. Kami akan kembali secepatnya.'}
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-ink-200" />
          <span className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">Ada pertanyaan?</span>
          <div className="flex-1 h-px bg-ink-200" />
        </div>

        {/* CTA */}
        <a
          href="https://wa.me/6281291544061"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-7 py-4 rounded-2xl transition active:scale-[.97] shadow-lg shadow-emerald-500/20"
        >
          <Icon.WhatsApp size={20} />
          Hubungi Admin via WhatsApp
        </a>

        <p className="text-xs text-ink-500 mt-4">0812-9154-4061</p>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-ink-200">
          <p className="text-[11px] text-ink-400">Jasa Order Kopi Kenangan</p>
        </div>
      </div>
    </div>
  );
}

function CoffeeCupAnimation() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-3">
      {/* Pulsing background */}
      <div
        className="absolute inset-0 rounded-full bg-accent-200/40 animate-ping"
        style={{ animationDuration: '3s' }}
      />
      <div className="absolute inset-2 rounded-full bg-accent-100/60" />

      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="cup-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A66D33" />
            <stop offset="100%" stopColor="#5C3B1C" />
          </linearGradient>
          <linearGradient id="coffee-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B2417" />
            <stop offset="100%" stopColor="#1F1209" />
          </linearGradient>
        </defs>

        {/* Steam wisps */}
        <g>
          <path
            d="M 80 70 Q 75 55 80 40 Q 85 30 80 20"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.6"
          >
            <animate
              attributeName="d"
              values="M 80 70 Q 75 55 80 40 Q 85 30 80 20;
                      M 80 70 Q 85 55 80 40 Q 75 30 80 20;
                      M 80 70 Q 75 55 80 40 Q 85 30 80 20"
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>

          <path
            d="M 100 65 Q 95 50 100 35 Q 105 25 100 15"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.5"
          >
            <animate
              attributeName="d"
              values="M 100 65 Q 95 50 100 35 Q 105 25 100 15;
                      M 100 65 Q 105 50 100 35 Q 95 25 100 15;
                      M 100 65 Q 95 50 100 35 Q 105 25 100 15"
              dur="3.5s"
              begin="0.3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.2;0.6;0.2"
              dur="3.5s"
              begin="0.3s"
              repeatCount="indefinite"
            />
          </path>

          <path
            d="M 120 70 Q 115 55 120 40 Q 125 30 120 20"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.6"
          >
            <animate
              attributeName="d"
              values="M 120 70 Q 115 55 120 40 Q 125 30 120 20;
                      M 120 70 Q 125 55 120 40 Q 115 30 120 20;
                      M 120 70 Q 115 55 120 40 Q 125 30 120 20"
              dur="3.2s"
              begin="0.6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="3.2s"
              begin="0.6s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        {/* Saucer */}
        <ellipse cx="100" cy="170" rx="55" ry="6" fill="#3F3F46" opacity="0.2" />
        <ellipse cx="100" cy="165" rx="50" ry="8" fill="url(#cup-gradient)" />

        {/* Cup body */}
        <path
          d="M 65 90 Q 65 85 70 85 L 130 85 Q 135 85 135 90 L 132 155 Q 130 165 120 165 L 80 165 Q 70 165 68 155 Z"
          fill="url(#cup-gradient)"
        />

        {/* Cup handle */}
        <path
          d="M 135 105 Q 155 105 155 125 Q 155 145 135 145"
          fill="none"
          stroke="url(#cup-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Cup rim */}
        <ellipse cx="100" cy="90" rx="35" ry="6" fill="#5C3B1C" />

        {/* Coffee surface */}
        <ellipse cx="100" cy="89" rx="32" ry="5" fill="url(#coffee-gradient)" />

        {/* Coffee shine */}
        <ellipse cx="92" cy="88" rx="8" ry="1.5" fill="#7C5A3A" opacity="0.6" />
      </svg>
    </div>
  );
}
