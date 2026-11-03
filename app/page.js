'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import HowToOrderModal from '@/components/HowToOrderModal';
import { Icon } from '@/components/Icons';
import { useCart, rupiah, applyDiscount } from '@/components/CartContext';

const PREVIEW_STORE_CODE = 'KK.BGR.RKRNCMYA';

const EXCLUDED_GROUP_KEYWORDS = ['promo', 'combo', 'bundle', 'paket'];
const EXCLUDED_TYPE_CODES = [4004];

function isExcludedGroup(group) {
  const name = (group.group_name || '').toLowerCase();
  return EXCLUDED_GROUP_KEYWORDS.some((k) => name.includes(k));
}
function isExcludedProduct(p) {
  if (p.is_combo_v2) return true;
  if (p.is_mix_match) return true;
  if (EXCLUDED_TYPE_CODES.includes(p.type_code)) return true;
  return false;
}

export default function HomePage() {
  const { setStore } = useCart();

  // Capture referral code dari URL ?ref=XXX
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      try {
        localStorage.setItem('ref-code', ref.toUpperCase());
      } catch (_) {}
    }
  }, []);

  const [query, setQuery] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStores, setTotalStores] = useState(0);

  const [previewMenu, setPreviewMenu] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);

  const [howToOpen, setHowToOpen] = useState(false);

  const searchInputRef = useRef(null);
  const searchSectionRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const res = await fetch(`/api/menu?store_code=${PREVIEW_STORE_CODE}`);
        const json = await res.json();
        if (cancel) return;
        if (!res.ok || json.error_code !== 0) {
          throw new Error(json.msg || 'Gagal memuat menu');
        }

        const groups = (json.data?.menu_groups || [])
          .filter((g) => !isExcludedGroup(g))
          .map((g) => ({
            ...g,
            menu_products: (g.menu_products || []).filter((p) => !isExcludedProduct(p)),
          }))
          .filter((g) => g.menu_products.length > 0);

        if (groups.length === 0) return;

        const seen = new Set();
        const all = [];
        for (const g of groups) {
          for (const p of g.menu_products) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            all.push(p);
          }
        }

        const groupsWithAll = [
          { group_code: '__all__', group_name: 'Semua', menu_products: all },
          ...groups,
        ];
        setPreviewMenu(groupsWithAll);
        setActiveGroup('__all__');
      } catch (e) {
        if (!cancel) setPreviewError(e.message || 'Gagal memuat menu');
      } finally {
        if (!cancel) setPreviewLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, []);

  async function search(q, pageIndex = 1, append = false) {
    if (!q.trim()) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(
        `/api/stores?query=${encodeURIComponent(q)}&page_index=${pageIndex}&page_size=20`
      );
      const json = await res.json();
      if (json.error_code !== 0) throw new Error(json.msg || 'Gagal memuat data');
      const newStores = json.data?.store || [];
      setStores((prev) => (append ? [...prev, ...newStores] : newStores));
      setPage(json.data?.page_index || pageIndex);
      setTotalPages(json.data?.pages || 1);
      setTotalStores(json.data?.total || newStores.length);
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan');
      if (!append) setStores([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    search(query, 1, false);
  }

  function loadMore() {
    if (page < totalPages && !loadingMore) {
      search(query, page + 1, true);
    }
  }

  function clearSearch() {
    setQuery('');
    setSearched(false);
    setStores([]);
    setError('');
    searchInputRef.current?.focus();
  }

  function focusSearch() {
    searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => searchInputRef.current?.focus(), 350);
  }

  function handleProductClick() {
    setHowToOpen(true);
  }

  function handleHowToPrimary() {
    setHowToOpen(false);
    focusSearch();
  }

  const currentGroup =
    previewMenu.find((g) => g.group_code === activeGroup) || previewMenu[0] || null;
  const products = currentGroup?.menu_products || [];

  return (
    <main className="pb-24">
      <Header title="Jasa Order Kopi Kenangan" subtitle="JasdorAja" />

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-3 md:pt-4">
        {/* Pilih Outlet CTA - prominent above search */}
        <section ref={searchSectionRef}>
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="w-full bg-gradient-to-r from-ink-900 to-accent-700 text-white rounded-2xl p-4 flex items-center gap-3 hover:opacity-95 active:scale-[.99] transition shadow-card"
          >
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
              <Icon.Pin size={22} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Pilih Outlet
              </p>
              <p className="text-sm font-bold mt-0.5">Cari outlet Kopi Kenangan terdekat</p>
            </div>
            <Icon.ChevronRight size={20} className="opacity-70" />
          </button>

          {/* Search field */}
          <form
            onSubmit={onSubmit}
            className="mt-2.5 flex items-center gap-2 bg-white border border-ink-200 rounded-2xl px-4 py-2.5 focus-within:border-ink-900 transition"
          >
            <span className="text-ink-500"><Icon.Search size={18} /></span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik nama daerah atau kota"
              className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none py-1"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-ink-400 hover:text-ink-900 px-1"
                aria-label="Hapus"
              >
                <Icon.Close size={14} />
              </button>
            )}
            <button
              type="submit"
              className="bg-ink-900 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg hover:bg-ink-800 active:scale-95 transition"
            >
              Cari
            </button>
          </form>
        </section>

        {/* Quick chips */}
        {!searched && (
          <section className="mt-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="shrink-0 text-[11px] font-medium text-ink-500 self-center mr-1">
                Populer:
              </span>
              {['Rancamaya', 'Bogor', 'Jakarta', 'Bandung', 'Depok', 'Bekasi'].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setQuery(p);
                    search(p, 1, false);
                  }}
                  className="shrink-0 text-xs bg-white border border-ink-200 px-3 py-1.5 rounded-full hover:border-ink-900 hover:bg-ink-900 hover:text-white text-ink-700 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Promo banner */}
        {!searched && (
          <section className="mt-4">
            <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 p-3.5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white grid place-items-center shrink-0 shadow-soft text-accent-600">
                <Icon.Gift size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink-900">Diskon 50% Otomatis</p>
                <p className="text-[11px] text-ink-700 mt-0.5 leading-snug">
                  Maks Rp 35.000 per pesanan. Pisah pesanan untuk dapat 2× potongan.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Testimoni CTA */}
        {!searched && (
          <section className="mt-3">
            <Link
              href="/testimonials"
              className="w-full rounded-2xl bg-white border border-ink-200 p-3.5 flex items-center gap-3 hover:border-ink-900 hover:shadow-card transition active:scale-[.99]"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 grid place-items-center shrink-0 text-emerald-600 border border-emerald-200">
                <Icon.Coffee size={20} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-ink-900">Lihat Testimoni</p>
                <p className="text-[11px] text-ink-500 mt-0.5 leading-snug">
                  Bukti pesanan pelanggan yang sudah sampai
                </p>
              </div>
              <Icon.ChevronRight size={18} className="text-ink-400 shrink-0" />
            </Link>
          </section>
        )}

        {/* Referral CTA */}
        {!searched && (
          <section className="mt-3">
            <Link
              href="/referral"
              className="w-full rounded-2xl bg-gradient-to-r from-accent-600 to-accent-700 text-white p-3.5 flex items-center gap-3 hover:opacity-95 active:scale-[.99] transition shadow-card"
            >
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
                <Icon.Gift size={20} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold">Program Referral</p>
                <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
                  Ajak teman, dapat saldo Rp 2.000 bisa ditarik ke e-wallet
                </p>
              </div>
              <Icon.ChevronRight size={18} className="opacity-80 shrink-0" />
            </Link>
          </section>
        )}

        {/* Search results */}
        {searched && (
          <section className="mt-5">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-900">
                Hasil &ldquo;{query}&rdquo;
              </h3>
              {!loading && stores.length > 0 && (
                <span className="text-xs text-ink-500">
                  {stores.length} dari {totalStores}
                </span>
              )}
            </div>

            {loading && (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-2xl shimmer" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && stores.length === 0 && (
              <div className="rounded-2xl bg-white border border-ink-200 p-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-ink-100 grid place-items-center mb-2 text-ink-500">
                  <Icon.Search size={20} />
                </div>
                <p className="text-sm font-semibold text-ink-900">Outlet tidak ditemukan</p>
                <p className="text-xs text-ink-500 mt-1">Coba kata kunci lain.</p>
              </div>
            )}

            {!loading && stores.length > 0 && (
              <>
                <div className="space-y-2.5">
                  {stores.map((s) => (
                    <StoreCard key={s.id} store={s} onSelect={() => setStore(s)} />
                  ))}
                </div>

                {page < totalPages && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="bg-white border border-ink-200 hover:border-ink-900 text-ink-900 text-xs font-semibold px-5 py-2.5 rounded-2xl transition disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <Icon.Spinner size={12} />
                          Memuat...
                        </>
                      ) : (
                        <>Muat lebih banyak</>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Preview Menu */}
        {!searched && (
          <section className="mt-6">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-ink-900">Menu Kopi Kenangan</h3>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Preview menu — pilih outlet untuk pesan
                </p>
              </div>
            </div>

            {/* Tabs */}
            {previewMenu.length > 0 && (
              <div className="sticky top-16 bg-ink-50/95 backdrop-blur z-20 -mx-4 px-4 py-2 border-b border-ink-200">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {previewMenu.map((g) => (
                    <button
                      key={g.group_code}
                      onClick={() => setActiveGroup(g.group_code)}
                      className={
                        'shrink-0 text-xs font-medium px-3.5 py-2 rounded-full transition active:scale-95 ' +
                        (activeGroup === g.group_code
                          ? 'bg-ink-900 text-white'
                          : 'bg-white text-ink-700 border border-ink-200 hover:border-ink-400')
                      }
                    >
                      {g.group_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              {previewLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-64 rounded-2xl shimmer" />
                  ))}
                </div>
              ) : previewError ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
                  <p className="text-sm font-semibold text-amber-900">Menu belum dapat dimuat</p>
                  <p className="text-xs text-amber-700 mt-1">{previewError}</p>
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-2xl bg-white border border-ink-200 p-6 text-center">
                  <p className="text-sm font-semibold text-ink-900">Belum ada menu</p>
                  <p className="text-xs text-ink-500 mt-1">
                    Cari outlet untuk melihat menu lengkap.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map((p) => (
                    <PreviewProductCard
                      key={p.id}
                      product={p}
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <HowToOrderModal
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        onPrimary={handleHowToPrimary}
      />
    </main>
  );
}

function StoreCard({ store, onSelect }) {
  return (
    <Link
      href={`/menu/${store.code}`}
      onClick={onSelect}
      className="group block rounded-2xl bg-white border border-ink-200 overflow-hidden hover:border-ink-900 transition fade-up"
    >
      <div className="flex gap-3 p-3">
        <div className="w-20 h-20 rounded-xl bg-ink-100 overflow-hidden shrink-0">
          {store.image_url ? (
            <img
              src={store.image_url}
              alt={store.name}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-400">
              <Icon.Store size={28} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-ink-900 truncate">{store.name}</h3>
            {store.is_open ? (
              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium border border-emerald-200">
                Buka
              </span>
            ) : (
              <span className="text-[9px] bg-ink-100 text-ink-600 px-1.5 py-0.5 rounded-full font-medium">
                Tutup
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink-500 mt-0.5 line-clamp-2">{store.address}</p>
          <div className="flex items-center justify-between mt-auto pt-1.5">
            <span className="text-[10px] text-ink-500 inline-flex items-center gap-1">
              <Icon.Clock size={10} />
              {store.open?.slice(0, 5)} - {store.close?.slice(0, 5)}
            </span>
            <span className="text-xs font-semibold text-ink-900 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
              Pesan <Icon.ArrowRight size={12} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PreviewProductCard({ product, onClick }) {
  const origPrice = Number(product.price) || 0;
  const finalPrice = applyDiscount(origPrice);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl bg-white border border-ink-200 overflow-hidden flex flex-col fade-up hover:border-ink-900 hover:shadow-card transition active:scale-[.98]"
    >
      <div className="aspect-square bg-ink-100 relative overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-400">
            <Icon.Coffee size={36} />
          </div>
        )}
        {origPrice > 0 && (
          <span className="absolute top-2 left-2 bg-ink-900 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            HEMAT 50%
          </span>
        )}
      </div>
      <div className="p-2.5 md:p-3 flex-1 flex flex-col">
        <h3 className="text-xs md:text-sm font-semibold leading-tight line-clamp-2 min-h-[2.4em] text-ink-900">
          {product.name}
        </h3>
        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-ink-900">{rupiah(finalPrice)}</span>
            {origPrice > finalPrice && (
              <span className="text-[10px] line-through text-ink-400">{rupiah(origPrice)}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
