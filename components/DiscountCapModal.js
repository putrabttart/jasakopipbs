'use client';

import { useEffect } from 'react';
import { Icon } from './Icons';

function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/**
 * Modal peringatan ketika diskon mencapai/melewati batas maks (Rp 35.000).
 *
 * Props:
 * - open: boolean
 * - mode: 'capped' (sudah penuh) | 'over' (akan melewati)
 * - lostSaving: number — potensi hemat yang hilang (untuk mode 'over')
 * - max: number — nilai DISCOUNT_MAX
 * - onCancel: () => void
 * - onConfirm: () => void
 */
export default function DiscountCapModal({
  open,
  mode = 'over',
  lostSaving = 0,
  max = 35000,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel]);

  if (!open) return null;

  const isOver = mode === 'over';

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden fade-up">
        {/* Header */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-ink-100">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 grid place-items-center mb-3 text-accent-600">
            <Icon.AlertTriangle size={28} />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-ink-900">
            {isOver ? 'Diskon akan melewati batas' : 'Diskon sudah maksimal'}
          </h2>
          <p className="text-sm text-ink-600 mt-1">
            Maksimal potongan {rupiah(max)} per pesanan
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 space-y-3">
          {isOver && lostSaving > 0 && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                Potensi hemat hilang
              </p>
              <p className="text-2xl font-extrabold text-red-700 mt-1">
                {rupiah(lostSaving)}
              </p>
              <p className="text-xs text-red-600/80 mt-1">
                Penghematan ini bisa kamu dapatkan kembali dengan pisah pesanan.
              </p>
            </div>
          )}

          {/* Tip pisah pesanan */}
          <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <span className="text-emerald-600"><Icon.Info size={18} /></span> Tips Hemat Maksimal
            </p>
            <p className="text-sm text-ink-700 mt-1.5 leading-relaxed">
              Selesaikan pesanan ini dulu, lalu buat <b>orderan baru</b> untuk dapat
              <b> diskon 50% lagi</b> (maks {rupiah(max)} setiap pesanan).
            </p>

            <div className="grid grid-cols-2 gap-2 mt-3 text-center text-xs">
              <div className="rounded-xl bg-white border border-ink-200 p-2.5">
                <p className="text-[10px] font-semibold text-red-500 uppercase">1 Pesanan</p>
                <p className="font-bold text-ink-900 mt-0.5">Hemat maks {rupiah(max)}</p>
              </div>
              <div className="rounded-xl bg-white border-2 border-emerald-400 p-2.5">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase">2 Pesanan</p>
                <p className="font-bold text-emerald-600 mt-0.5">Hemat 2× potongan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pt-4 pb-5 flex flex-col gap-2">
          <button
            onClick={onCancel}
            className="w-full bg-ink-900 hover:bg-ink-800 text-white text-sm font-semibold py-3.5 rounded-2xl transition active:scale-[.98]"
          >
            Batal & Checkout Dulu
          </button>
          <button
            onClick={onConfirm}
            className="w-full bg-white border border-ink-200 hover:border-ink-900 text-ink-700 text-sm font-medium py-3 rounded-2xl transition"
          >
            Tetap tambahkan
          </button>
        </div>
      </div>
    </div>
  );
}
