'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import OptionsModal from '@/components/OptionsModal';
import DiscountCapModal from '@/components/DiscountCapModal';
import { fetchOptions, hasCustomization, buildSimpleCartItem } from '@/components/productOptions';
import { useCart, rupiah, applyDiscount } from '@/components/CartContext';
import { Icon } from '@/components/Icons';

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

export default function MenuPage({ params }) {
  const storeCode = decodeURIComponent(params.storeCode);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [prefetchedOptions, setPrefetchedOptions] = useState(null);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [toast, setToast] = useState('');
  const [capModal, setCapModal] = useState({ open: false, mode: 'over', lostSaving: 0 });
  const pendingActionRef = useRef(null);

  const { items, store, addItem, totalQty, subtotal, origSubtotal, DISCOUNT_RATE, DISCOUNT_MAX } = useCart();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  /**
   * Cek apakah penambahan produk akan membuat diskon melewati cap.
   * Jika perlu konfirmasi: tampilkan modal & simpan action di pendingActionRef.
   * Jika tidak perlu: langsung jalankan action.
   */
  function withDiscountCheck(addedOrigPrice, addedQty, action) {
    const currentDiscount = Math.floor(origSubtotal * DISCOUNT_RATE);
    if (currentDiscount >= DISCOUNT_MAX) {
      pendingActionRef.current = action;
      setCapModal({ open: true, mode: 'capped', lostSaving: 0 });
      return;
    }
    const newOrig = origSubtotal + (Number(addedOrigPrice) || 0) * (addedQty || 1);
    const newDiscount = Math.floor(newOrig * DISCOUNT_RATE);
    if (newDiscount > DISCOUNT_MAX) {
      pendingActionRef.current = action;
      setCapModal({
        open: true,
        mode: 'over',
        lostSaving: newDiscount - DISCOUNT_MAX,
      });
      return;
    }
    action();
  }

  function handleCapConfirm() {
    const fn = pendingActionRef.current;
    pendingActionRef.current = null;
    setCapModal((c) => ({ ...c, open: false }));
    if (fn) fn();
  }

  function handleCapCancel() {
    pendingActionRef.current = null;
    setCapModal((c) => ({ ...c, open: false }));
  }

  async function handleAddProduct(product) {
    if (loadingProductId) return;

    setLoadingProductId(product.id);
    try {
      if (product.local_catalog) {
        const item = {
          id: product.product_code || `local_${product.id}`,
          name: product.name,
          product_code: product.product_code || `local_${product.id}`,
          price: Number(product.price) || 0,
          image: product.image || '',
          variant: '',
          addons: [],
          notes: [],
        };
        withDiscountCheck(item.price, 1, () => {
          addItem(item, store);
          showToast('Berhasil ditambahkan ke keranjang');
        });
        return;
      }

      const optData = await fetchOptions(product, storeCode);

      if (hasCustomization(optData)) {
        // Buka modal opsi — pengecekan diskon dilakukan di dalam modal saat user klik "Tambah".
        setPrefetchedOptions(optData);
        setSelectedProduct(product);
      } else {
        // Produk tanpa opsi → cek diskon di sini, lalu langsung tambah.
        const item = buildSimpleCartItem(product, optData);
        const itemPrice = Number(item.price) || 0;
        withDiscountCheck(itemPrice, 1, () => {
          addItem(item, store);
          showToast('Berhasil ditambahkan ke keranjang');
        });
      }
    } catch (e) {
      showToast(e.message || 'Gagal menambahkan produk');
    } finally {
      setLoadingProductId(null);
    }
  }

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/menu?store_code=${encodeURIComponent(storeCode)}`);
        const json = await res.json();
        if (cancel) return;
        if (json.error_code !== 0) throw new Error(json.msg || 'Gagal memuat menu');
        setData(json.data);
      } catch (e) {
        if (!cancel) setError(e.message || 'Terjadi kesalahan');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [storeCode]);

  const filteredGroups = useMemo(() => {
    if (!data?.menu_groups) return [];
    const groups = data.menu_groups
      .filter((g) => !isExcludedGroup(g))
      .map((g) => ({
        ...g,
        menu_products: (g.menu_products || []).filter((p) => !isExcludedProduct(p)),
      }))
      .filter((g) => g.menu_products.length > 0);

    if (groups.length === 0) return [];

    // Buat kategori "Semua" yang menggabungkan semua produk (tanpa duplikat by id)
    const seen = new Set();
    const allProducts = [];
    for (const g of groups) {
      for (const p of g.menu_products) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        allProducts.push(p);
      }
    }

    return [
      {
        group_code: '__all__',
        group_name: 'Semua',
        menu_products: allProducts,
      },
      ...groups,
    ];
  }, [data]);

  useEffect(() => {
    if (!activeGroup && filteredGroups[0]) {
      setActiveGroup(filteredGroups[0].group_code);
    }
  }, [filteredGroups, activeGroup]);

  const currentGroup = filteredGroups.find((g) => g.group_code === activeGroup) || filteredGroups[0];

  const products = useMemo(() => {
    if (!currentGroup) return [];
    let list = currentGroup.menu_products || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentGroup, search]);

  return (
    <main className="pb-32">
      <Header
        title={store?.name || `Outlet ${storeCode}`}
        subtitle="Pilih Menu"
        back="/"
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Store info banner */}
        {store && (
          <section className="pt-4 md:pt-6">
            <div className="rounded-2xl overflow-hidden bg-white border border-ink-200">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-56 lg:w-64 h-40 md:h-auto bg-ink-100 relative overflow-hidden shrink-0">
                  {store.image_url ? (
                    <img
                      src={store.image_url}
                      alt={store.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-ink-400">
                      <Icon.Store size={56} />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-lg md:text-xl text-ink-900 line-clamp-1">
                        {store.name}
                      </h2>
                      <p className="text-xs md:text-sm text-ink-500 line-clamp-2 mt-1">
                        {store.address}
                      </p>
                    </div>
                    {store.is_open ? (
                      <span className="shrink-0 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium border border-emerald-200">
                        ● Buka
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] bg-ink-100 text-ink-600 px-2 py-1 rounded-full font-medium">
                        ● Tutup
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-ink-700 bg-ink-100 px-2.5 py-1 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {store.open?.slice(0, 5)} - {store.close?.slice(0, 5)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-accent-600 bg-accent-50 px-2.5 py-1 rounded-full font-medium">
                      Diskon 50% • maks Rp 35rb
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-ink-700 bg-ink-100 px-2.5 py-1 rounded-full">
                      {filteredGroups
                        .filter((g) => g.group_code !== '__all__')
                        .reduce((a, g) => a + g.menu_products.length, 0)}{' '}
                      menu
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Search bar */}
        <section className="mt-4">
          <div className="flex items-center gap-2 bg-white border border-ink-200 rounded-2xl px-4 py-3 hover:border-ink-400 focus-within:border-ink-900 transition">
            <span className="text-ink-500"><Icon.Search size={18} /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu di outlet ini"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-ink-500 hover:text-ink-900"
                aria-label="Hapus pencarian"
              >
                <Icon.Close size={14} />
              </button>
            )}
          </div>
        </section>

        {/* Layout */}
        <div className="mt-4 md:grid md:grid-cols-[220px_1fr] md:gap-6">
          {/* Mobile tabs */}
          {filteredGroups.length > 0 && (
            <div className="md:hidden sticky top-16 glass z-20 -mx-4 px-4 border-b border-ink-200">
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-3">
                {filteredGroups.map((g) => (
                  <button
                    key={g.group_code}
                    onClick={() => setActiveGroup(g.group_code)}
                    className={
                      'shrink-0 text-xs font-medium px-4 py-2 rounded-full transition active:scale-95 ' +
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

          {/* Desktop sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-20 rounded-2xl bg-white border border-ink-200 p-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 px-3 pt-2 pb-1.5">
                Kategori
              </p>
              <nav className="flex flex-col gap-0.5 max-h-[calc(100vh-160px)] overflow-y-auto scrollbar-thin">
                {filteredGroups.map((g) => {
                  const active = activeGroup === g.group_code;
                  return (
                    <button
                      key={g.group_code}
                      onClick={() => setActiveGroup(g.group_code)}
                      className={
                        'flex items-center justify-between text-left text-sm px-3 py-2.5 rounded-xl transition ' +
                        (active
                          ? 'bg-ink-900 text-white font-medium'
                          : 'text-ink-700 hover:bg-ink-100')
                      }
                    >
                      <span className="truncate">{g.group_name}</span>
                      <span
                        className={
                          'text-[10px] px-1.5 py-0.5 rounded-full ' +
                          (active ? 'bg-white/15' : 'bg-ink-100 text-ink-600')
                        }
                      >
                        {g.menu_products.length}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Products */}
          <div>
            {loading && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-72 rounded-2xl shimmer" />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mt-3">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {currentGroup && (
                  <div className="hidden md:flex items-baseline justify-between mb-4 mt-1">
                    <h3 className="text-lg font-semibold text-ink-900">
                      {currentGroup.group_name}
                    </h3>
                    <p className="text-xs text-ink-500">{products.length} menu</p>
                  </div>
                )}

                {products.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-ink-200 p-10 text-center mt-3">
                    <div className="w-14 h-14 mx-auto rounded-full bg-ink-100 grid place-items-center mb-3 text-ink-400">
                      <Icon.Coffee size={28} />
                    </div>
                    <p className="text-sm font-semibold text-ink-900">
                      {search ? 'Menu tidak ditemukan' : 'Belum ada menu di kategori ini'}
                    </p>
                    {search && (
                      <p className="text-xs text-ink-500 mt-1">Coba kata kunci lain.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {products.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        loading={loadingProductId === p.id}
                        onAdd={() => handleAddProduct(p)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Options modal */}
      {selectedProduct && (
        <OptionsModal
          product={selectedProduct}
          storeCode={storeCode}
          store={store}
          prefetchedData={prefetchedOptions}
          checkDiscountCap={withDiscountCheck}
          onClose={() => {
            setSelectedProduct(null);
            setPrefetchedOptions(null);
          }}
          onAdded={() => showToast('Berhasil ditambahkan ke keranjang')}
        />
      )}

      {/* Discount cap warning */}
      <DiscountCapModal
        open={capModal.open}
        mode={capModal.mode}
        lostSaving={capModal.lostSaving}
        max={DISCOUNT_MAX}
        onCancel={handleCapCancel}
        onConfirm={handleCapConfirm}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-ink-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-card fade-up flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {toast}
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      {totalQty > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-ink-200"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-md md:max-w-lg mx-auto px-4 pt-3">
            <Link
              href="/cart"
              className="flex items-center justify-between bg-ink-900 text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-ink-900/20 hover:bg-ink-800 active:scale-[.98] transition"
            >
              <div className="flex items-center gap-3">
                <span className="bg-white/15 px-2.5 py-1 rounded-lg text-xs font-semibold">
                  {totalQty} item
                </span>
                <span className="text-sm font-medium">Lihat Keranjang</span>
              </div>
              <div className="text-right flex flex-col items-end leading-none">
                {origSubtotal > subtotal && (
                  <span className="text-[10px] line-through opacity-60">
                    {rupiah(origSubtotal)}
                  </span>
                )}
                <span className="text-sm font-semibold mt-0.5">
                  {rupiah(subtotal)} →
                </span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function ProductCard({ product, onAdd, loading }) {
  const origPrice = Number(product.price) || 0;
  const finalPrice = applyDiscount(origPrice);
  const soldOut = product.is_sold_out;
  const disabled = soldOut || loading;

  return (
    <div className="group rounded-2xl bg-white border border-ink-200 overflow-hidden flex flex-col fade-up hover:border-ink-900 transition">
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
        {soldOut && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm grid place-items-center">
            <span className="text-ink-900 font-semibold text-sm bg-white border border-ink-300 px-3 py-1 rounded-full">
              Habis
            </span>
          </div>
        )}
      </div>
      <div className="p-3 md:p-4 flex-1 flex flex-col">
        <h3 className="text-xs md:text-sm font-semibold leading-tight line-clamp-2 min-h-[2.4em] text-ink-900">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-[10px] md:text-[11px] text-ink-500 line-clamp-2 mt-1">
            {product.description}
          </p>
        )}
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm md:text-base font-bold text-ink-900">
              {rupiah(finalPrice)}
            </span>
            {origPrice > finalPrice && (
              <span className="text-[10px] line-through text-ink-400">
                {rupiah(origPrice)}
              </span>
            )}
          </div>
          <button
            disabled={disabled}
            onClick={onAdd}
            className="w-full mt-2.5 bg-ink-900 text-white text-xs md:text-sm font-medium py-2 md:py-2.5 rounded-xl hover:bg-ink-800 active:scale-95 disabled:bg-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
          >
            {soldOut ? (
              'Habis'
            ) : loading ? (
              <>
                <Icon.Spinner size={14} />
                Memuat
              </>
            ) : (
              <>
                <Icon.Plus size={14} />
                Tambah
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
