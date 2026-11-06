'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import HowToOrderModal from '@/components/HowToOrderModal';
import { Icon } from '@/components/Icons';
import { useCart, rupiah, applyDiscount } from '@/components/CartContext';

const PREVIEW_STORE_CODE = 'KK.BGR.RKRNCMYA';
const BRANDS = [
  { code: 'kopi-kenangan', name: 'Kopi Kenangan' },
  { code: 'fore-coffee', name: 'Fore Coffee' },
];

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

export default function HomePage({ searchParams }) {
  const { setStore } = useCart();
  const initialBrand = BRANDS.some((item) => item.code === searchParams?.brand)
    ? searchParams.brand
    : 'kopi-kenangan';
  const [brand] = useState(initialBrand);

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
      setPreviewMenu([]);
      setActiveGroup(null);
      try {
        const res = await fetch(
          `/api/menu?brand=${encodeURIComponent(brand)}&store_code=${PREVIEW_STORE_CODE}`
        );
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
  }, [brand]);

  async function search(q, pageIndex = 1, append = false) {
    if (!q.trim()) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(
        `/api/stores?brand=${encodeURIComponent(brand)}&query=${encodeURIComponent(q)}&page_index=${pageIndex}&page_size=20`
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
    <main className="pb-24 overflow-hidden">
      <Header title="Jasdor PBS" subtitle="Jasa Order Kopi" />

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-7 md:pt-10">
        <section ref={searchSectionRef} className="border-b border-ink-200 pb-8 md:pb-10">
          <div className="max-w-3xl">
            <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-accent-600 mb-3">
              Jasdor PBS
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.045em] leading-[1.02] text-ink-900">
              Kopi favorit, lebih hemat.
            </h2>
            <p className="text-sm md:text-base leading-6 text-ink-500 mt-3">
              Pesan dari outlet terdekat dengan diskon 50% hingga Rp35.000.
            </p>
          </div>

          <div className="grid lg:grid-cols-[300px_1fr] gap-3 mt-7 max-w-5xl">
            <div className="flex gap-1 p-1 rounded-full border border-ink-200 bg-white">
              {BRANDS.map((item) => (
                <a
                  key={item.code}
                  href={`/?brand=${encodeURIComponent(item.code)}`}
                  className={
                    'flex-1 rounded-full px-3 py-3 text-xs font-semibold text-center transition ' +
                    (brand === item.code
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-500 hover:text-ink-900')
                  }
                >
                  {item.name}
                </a>
              ))}
            </div>
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-3 bg-white border border-ink-200 rounded-full p-1.5 pl-5 focus-within:border-ink-900 focus-within:shadow-card transition"
            >
              <span className="text-ink-500"><Icon.Search size={18} /></span>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari daerah atau kota"
                className="flex-1 min-w-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none py-2"
              />
              {query && (
                <button type="button" onClick={clearSearch} className="text-ink-400 hover:text-ink-900 px-1" aria-label="Hapus">
                  <Icon.Close size={14} />
                </button>
              )}
              <button type="submit" className="bg-ink-900 text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-accent-700 active:scale-95 transition">
                Cari outlet
              </button>
            </form>
          </div>
          {!searched && (
            <div className="lg:ml-[312px] mt-3 flex gap-2 overflow-x-auto no-scrollbar max-w-2xl">
              <span className="shrink-0 text-[11px] text-ink-400 self-center mr-1">Pencarian populer</span>
              {['Bogor', 'Jakarta', 'Bandung', 'Depok', 'Bekasi'].map((p) => (
                <button key={p} onClick={() => { setQuery(p); search(p, 1, false); }} className="shrink-0 text-xs text-ink-600 px-3 py-1.5 rounded-full border border-ink-200 hover:border-ink-500 hover:text-ink-900 transition">{p}</button>
              ))}
            </div>
          )}
        </section>

        {!searched && (
          <section className="grid md:grid-cols-3 border-b border-ink-200">
            <div className="py-7 md:pr-8 border-b md:border-b-0 md:border-r border-ink-200">
              <span className="text-[10px] font-bold tracking-[.2em] text-accent-600">01</span>
              <h3 className="font-bold text-ink-900 mt-3">Diskon 50% otomatis</h3>
              <p className="text-xs text-ink-500 leading-5 mt-1.5">Potongan maksimal Rp35.000 langsung untuk setiap pesanan.</p>
            </div>
            <Link href="/testimonials" className="group py-7 md:px-8 border-b md:border-b-0 md:border-r border-ink-200">
              <span className="text-[10px] font-bold tracking-[.2em] text-accent-600">02</span>
              <h3 className="font-bold text-ink-900 mt-3 flex items-center justify-between">Pesanan nyata <Icon.ArrowRight size={15} className="group-hover:translate-x-1 transition" /></h3>
              <p className="text-xs text-ink-500 leading-5 mt-1.5">Lihat testimoni pelanggan yang pesanannya sudah sampai.</p>
            </Link>
            <Link href="/referral" className="group py-7 md:pl-8">
              <span className="text-[10px] font-bold tracking-[.2em] text-accent-600">03</span>
              <h3 className="font-bold text-ink-900 mt-3 flex items-center justify-between">Ajak teman <Icon.ArrowRight size={15} className="group-hover:translate-x-1 transition" /></h3>
              <p className="text-xs text-ink-500 leading-5 mt-1.5">Dapatkan saldo Rp2.000 yang bisa ditarik ke e-wallet.</p>
            </Link>
          </section>
        )}

        {/* Search results */}
        {searched && (
          <section className="py-10 max-w-4xl mx-auto">
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
                <div className="bg-white border-y border-ink-200 divide-y divide-ink-200">
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
          <section className="pt-12 md:pt-20">
            <div className="flex items-end justify-between mb-7 md:mb-10">
              <div>
                <p className="text-[10px] uppercase tracking-[.25em] font-bold text-accent-600 mb-2">Pilihan hari ini</p>
                <h3 className="text-3xl md:text-4xl tracking-tight font-bold text-ink-900">
                  Menu {BRANDS.find((item) => item.code === brand)?.name}
                </h3>
                <p className="text-sm text-ink-500 mt-2">
                  Pilih outlet terlebih dahulu untuk mulai memesan.
                </p>
              </div>
            </div>

            {/* Tabs */}
            {previewMenu.length > 0 && (
              <div className="sticky top-[71px] bg-[#f7f6f2]/95 backdrop-blur z-20 -mx-5 md:-mx-8 px-5 md:px-8 py-3 border-y border-ink-200">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {previewMenu.map((g) => (
                    <button
                      key={g.group_code}
                      onClick={() => setActiveGroup(g.group_code)}
                      className={
                        'shrink-0 text-xs font-medium px-3.5 py-2 rounded-full transition active:scale-95 ' +
                        (activeGroup === g.group_code
                         ? 'bg-ink-900 text-white'
                           : 'text-ink-600 border border-transparent hover:border-ink-300')
                      }
                    >
                      {g.group_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

             <div className="mt-7">
              {previewLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 md:gap-x-5 gap-y-8">
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 md:gap-x-5 gap-y-8">
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
      href={`/menu/${store.code}?brand=${encodeURIComponent(store.brand_code || 'kopi-kenangan')}`}
      onClick={onSelect}
      className="group block hover:bg-ink-50 transition fade-up"
    >
      <div className="flex gap-4 px-1 py-5 sm:px-5 sm:py-6 items-start">
        <div className="w-10 h-10 rounded-full border border-ink-200 bg-[#f7f6f2] grid place-items-center text-ink-500 shrink-0">
          <Icon.Pin size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-ink-900">{store.name}</h3>
            {store.is_open ? (
                  <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                Buka
              </span>
            ) : (
                  <span className="text-[9px] text-ink-400 font-bold uppercase tracking-wider">
                Tutup
              </span>
            )}
              </div>
              <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-5">{store.address}</p>
            </div>
            <span className="w-9 h-9 rounded-full border border-ink-200 grid place-items-center text-ink-700 shrink-0 group-hover:bg-ink-900 group-hover:text-white group-hover:border-ink-900 transition">
              <Icon.ArrowRight size={14} />
            </span>
          </div>
          <div className="mt-2 text-[10px] text-ink-400 inline-flex items-center gap-1.5">
              <Icon.Clock size={11} />
              {store.open?.slice(0, 5)} - {store.close?.slice(0, 5)}
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
      className="group text-left flex flex-col fade-up active:scale-[.98] transition"
    >
      <div className="aspect-square rounded-[1.25rem] bg-ink-100 relative overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-400">
            <Icon.Coffee size={36} />
          </div>
        )}
        {origPrice > 0 && (
          <span className="absolute top-3 left-3 bg-white/95 text-ink-900 text-[9px] tracking-wider font-bold px-2.5 py-1.5 rounded-full shadow-soft">
            HEMAT 50%
          </span>
        )}
      </div>
      <div className="pt-3 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.7em] text-ink-900 group-hover:text-accent-700 transition">
          {product.name}
        </h3>
        <div className="mt-auto pt-1.5">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-accent-700">{rupiah(finalPrice)}</span>
            {origPrice > finalPrice && (
              <span className="text-[10px] line-through text-ink-400">{rupiah(origPrice)}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
