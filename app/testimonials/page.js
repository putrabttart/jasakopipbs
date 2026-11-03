'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Icon } from '@/components/Icons';

export default function TestimonialsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // index for lightbox

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/testimonials');
      const json = await res.json();
      if (json.error_code === 0) setItems(json.data || []);
    } catch (_) {}
    setLoading(false);
  }

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (active === null) return;
    function onKey(e) {
      if (e.key === 'Escape') setActive(null);
      if (e.key === 'ArrowRight') setActive((i) => Math.min(items.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, i - 1));
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [active, items.length]);

  return (
    <main className="pb-24">
      <Header title="Testimoni Pelanggan" subtitle="Iqbal" back="/" />

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-3 md:pt-4">
        {/* Hero */}
        <section className="rounded-2xl bg-gradient-to-r from-ink-900 to-accent-700 text-white p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
            <Icon.Gift size={22} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
              Testimoni
            </p>
            <p className="text-sm font-bold mt-0.5">
              Bukti pesanan yang sudah sampai ke pelanggan
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl shimmer" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white border border-ink-200 p-10 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-ink-100 grid place-items-center mb-3 text-ink-400">
                <Icon.Coffee size={24} />
              </div>
              <p className="text-sm font-semibold text-ink-900">Belum ada testimoni</p>
              <p className="text-xs text-ink-500 mt-1">
                Testimoni akan ditampilkan di sini segera
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-ink-100 fade-up"
                >
                  <img
                    src={it.url}
                    alt="Testimoni pelanggan"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => setActive(idx)}
                    className="absolute inset-0 flex items-end p-2.5 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"
                    aria-label="Lihat detail testimoni"
                  >
                    <span className="w-full inline-flex items-center justify-center gap-1.5 bg-white/95 backdrop-blur text-ink-900 text-[11px] font-bold py-2 rounded-xl shadow-card active:scale-95 transition">
                      Lihat Detail
                      <Icon.ArrowRight size={12} />
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Lightbox */}
      {active !== null && items[active] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button
            onClick={() => setActive(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white"
            aria-label="Tutup"
          >
            <Icon.Close size={20} />
          </button>

          {active > 0 && (
            <button
              onClick={() => setActive(active - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white"
              aria-label="Sebelumnya"
            >
              <Icon.ChevronLeft size={20} />
            </button>
          )}
          {active < items.length - 1 && (
            <button
              onClick={() => setActive(active + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white"
              aria-label="Berikutnya"
            >
              <Icon.ChevronRight size={20} />
            </button>
          )}

          <img
            src={items[active].url}
            alt="Testimoni pelanggan"
            className="max-w-[95vw] max-h-[85vh] object-contain"
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs">
            {active + 1} / {items.length}
          </div>
        </div>
      )}
    </main>
  );
}
