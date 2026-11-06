'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icons';

const STORAGE_KEY = 'jasdor-welcome-seen-v2';

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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-5">
      <div
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]"
        onClick={close}
      />

      <div className="relative w-full sm:max-w-md bg-[#f7f6f2] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden fade-up">
        <button
          type="button"
          onClick={close}
          className="absolute right-5 top-5 w-9 h-9 rounded-full border border-ink-200 bg-white grid place-items-center text-ink-500 hover:text-ink-900 hover:border-ink-400 transition"
          aria-label="Tutup"
        >
          <Icon.Close size={15} />
        </button>

        <div className="px-6 sm:px-8 pt-8 pb-6">
          <div className="w-11 h-11 rounded-full bg-ink-900 text-white grid place-items-center mb-6">
            <Icon.Coffee size={20} />
          </div>
          <p className="text-[10px] uppercase tracking-[.25em] font-bold text-accent-600">
            Sebelum memesan
          </p>
          <h2 className="text-2xl sm:text-3xl tracking-tight font-bold text-ink-900 mt-2">
            Ngopi lebih hemat di Jasdor PBS.
          </h2>
          <p className="text-sm text-ink-500 leading-6 mt-3">
            Setiap pesanan mendapat diskon 50% dengan potongan maksimal Rp35.000.
          </p>
        </div>

        <div className="mx-6 sm:mx-8 border-y border-ink-200 py-5">
          <div className="flex gap-4">
            <span className="w-8 h-8 rounded-full border border-accent-300 text-accent-600 grid place-items-center shrink-0">
              <Icon.Info size={15} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">Tips hemat maksimal</p>
              <p className="text-xs sm:text-sm text-ink-500 mt-1 leading-5">
                Jika total lebih dari Rp70.000, pisahkan menjadi dua pesanan agar potongannya bisa lebih besar.
              </p>
            </div>
          </div>
          <div className="mt-4 ml-12 flex items-center gap-3 text-xs">
            <span className="text-ink-400 line-through">1 pesanan: hemat Rp35rb</span>
            <Icon.ArrowRight size={13} className="text-ink-400" />
            <span className="font-bold text-emerald-700">2 pesanan: hemat Rp50rb</span>
          </div>
        </div>

        <div className="px-6 sm:px-8 pt-5 pb-6 sm:pb-8">
          <button
            onClick={close}
            className="w-full bg-ink-900 text-white text-sm font-semibold py-3.5 rounded-full hover:bg-ink-800 active:scale-[.98] transition"
          >
            Mulai cari outlet
          </button>
          <label className="flex justify-center items-center gap-2 text-xs text-ink-500 select-none cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="w-4 h-4 rounded border-ink-300 accent-ink-900"
            />
            Jangan tampilkan lagi
          </label>
        </div>
      </div>
    </div>
  );
}
