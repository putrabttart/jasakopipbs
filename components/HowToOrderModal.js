'use client';

import { useEffect } from 'react';
import { Icon } from './Icons';

export default function HowToOrderModal({ open, onClose, onPrimary }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden fade-up">
        {/* Header */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-ink-100">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-ink-900 to-accent-700 grid place-items-center mb-3 text-white">
            <Icon.Pin size={28} />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-ink-900">
            Cari outlet terdekatmu dulu
          </h2>
          <p className="text-sm text-ink-600 mt-1">
            Menu dan harga bisa berbeda di tiap outlet. Pilih outlet dulu untuk mulai pesan.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 pt-5 space-y-3">
          <Step
            num="1"
            title="Cari outlet"
            desc="Ketik nama daerah atau kota, contoh: Rancamaya, Bogor, Jakarta."
          />
          <Step
            num="2"
            title="Pilih menu"
            desc="Lihat menu yang tersedia di outlet yang kamu pilih."
          />
          <Step
            num="3"
            title="Checkout via WhatsApp"
            desc="Kirim pesanan ke admin, tinggal tunggu konfirmasi."
          />
        </div>

        {/* Action */}
        <div className="px-6 pt-5 pb-5">
          <button
            onClick={onPrimary}
            className="w-full bg-ink-900 hover:bg-ink-800 text-white text-sm font-semibold py-3.5 rounded-2xl transition active:scale-[.98] flex items-center justify-center gap-2"
          >
            <Icon.Search size={16} />
            Cari Outlet Sekarang
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 text-ink-500 text-xs font-medium py-2"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ num, title, desc }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center text-xs font-bold shrink-0">
        {num}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
