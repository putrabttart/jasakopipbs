'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icons';

const STORAGE_KEY = 'jasdor-welcome-seen-v1';

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch (_) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line
  }, [open]);

  function close() {
    try {
      if (dontShow) localStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
        onClick={close}
      />

      <div className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden fade-up">
        {/* Header sederhana */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-ink-100">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-50 grid place-items-center mb-3 text-accent-600">
            <Icon.Gift size={32} />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-ink-900">
            Selamat datang!
          </h2>
          <p className="text-sm text-ink-600 mt-1">
            Jasa Order <span className="font-semibold text-ink-900">Kopi Kenangan</span>
          </p>
        </div>

        {/* Big highlight */}
        <div className="px-6 pt-5">
          <div className="rounded-2xl bg-ink-900 text-white p-5 text-center">
            <p className="text-xs uppercase tracking-wider opacity-70 font-semibold">
              Setiap pesanan dapat
            </p>
            <p className="text-3xl md:text-4xl font-extrabold mt-1">
              Diskon 50%
            </p>
            <p className="text-sm opacity-90 mt-1">
              maksimal potongan{' '}
              <span className="font-bold text-accent-200">Rp 35.000</span>
            </p>
          </div>
        </div>

        {/* Tip utama */}
        <div className="px-6 pt-5">
          <div className="rounded-2xl border-2 border-dashed border-accent-300 bg-accent-50 p-4">
            <p className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <span className="text-accent-600"><Icon.Info size={18} /></span> Tips Hemat Maksimal
            </p>
            <p className="text-sm text-ink-700 mt-1.5 leading-relaxed">
              Kalau total belanja kamu <b>lebih dari Rp 70.000</b>, pisah jadi{' '}
              <b>2 pesanan terpisah</b>. Diskon jadi 2x lipat!
            </p>

            {/* Contoh */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white border border-ink-200 p-3">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                  ✕ Kurang hemat
                </p>
                <p className="text-xs text-ink-500 mt-1">1 pesanan Rp 100.000</p>
                <p className="text-sm font-bold text-ink-900 mt-1">Hemat Rp 35rb</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border-2 border-emerald-400 p-3">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                  ✓ Lebih hemat
                </p>
                <p className="text-xs text-ink-500 mt-1">2× pesanan Rp 50rb</p>
                <p className="text-sm font-bold text-emerald-600 mt-1">Hemat Rp 50rb</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pt-5 pb-5">
          <label className="flex items-center gap-2 text-xs text-ink-600 select-none cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="w-4 h-4 rounded border-ink-300 accent-ink-900"
            />
            Jangan tampilkan lagi
          </label>
          <button
            onClick={close}
            className="w-full bg-ink-900 text-white text-base font-semibold py-4 rounded-2xl hover:bg-ink-800 active:scale-[.98] transition"
          >
            Saya Mengerti, Mulai Pesan
          </button>
        </div>
      </div>
    </div>
  );
}
