'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import DiscountCapModal from '@/components/DiscountCapModal';
import { Icon } from '@/components/Icons';
import { useCart, rupiah } from '@/components/CartContext';

export default function CartPage() {
  const {
    items,
    store,
    updateQty,
    removeItem,
    subtotal,
    origSubtotal,
    discount,
    discountCapped,
    serviceFee,
    total,
    DISCOUNT_RATE,
    DISCOUNT_MAX,
  } = useCart();
  const router = useRouter();
  const [capModal, setCapModal] = useState({ open: false, mode: 'over', lostSaving: 0 });
  const pendingRef = useRef(null);

  function tryIncrement(it) {
    const itemPrice = Number(it.orig_price || it.price);
    const currentDiscount = Math.floor(origSubtotal * DISCOUNT_RATE);
    const action = () => updateQty(it.id, it.qty + 1);

    if (currentDiscount >= DISCOUNT_MAX) {
      pendingRef.current = action;
      setCapModal({ open: true, mode: 'capped', lostSaving: 0 });
      return;
    }
    const newDiscount = Math.floor((origSubtotal + itemPrice) * DISCOUNT_RATE);
    if (newDiscount > DISCOUNT_MAX) {
      pendingRef.current = action;
      setCapModal({ open: true, mode: 'over', lostSaving: newDiscount - DISCOUNT_MAX });
      return;
    }
    action();
  }

  function handleCapConfirm() {
    const fn = pendingRef.current;
    pendingRef.current = null;
    setCapModal((c) => ({ ...c, open: false }));
    if (fn) fn();
  }

  function handleCapCancel() {
    pendingRef.current = null;
    setCapModal((c) => ({ ...c, open: false }));
  }

  const empty = items.length === 0;

  return (
    <main className="pb-32">
      <Header
        title="Keranjang"
        subtitle="Review Pesanan"
        back={store ? `/menu/${store.code}` : '/'}
        showCart={false}
      />

      <div className="max-w-5xl mx-auto px-4 md:px-6">
        {empty ? (
          <div className="mt-12 text-center max-w-md mx-auto">
            <div className="w-20 h-20 mx-auto rounded-full bg-ink-100 grid place-items-center mb-4 text-ink-400">
              <Icon.Bag size={36} />
            </div>
            <p className="font-semibold text-lg text-ink-900">Keranjang masih kosong</p>
            <p className="text-sm text-ink-500 mt-1">
              Yuk pilih menu favoritmu dulu di outlet pilihanmu.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-5 bg-ink-900 text-white text-sm font-semibold px-6 py-3 rounded-2xl hover:bg-ink-800 active:scale-95 transition"
            >
              Cari Outlet →
            </Link>
          </div>
        ) : (
          <div className="md:grid md:grid-cols-[1fr_360px] md:gap-6 mt-4 md:mt-6">
            <div>
              {/* Outlet info */}
              {store && (
                <section>
                  <div className="rounded-2xl bg-white border border-ink-200 p-3 md:p-4 flex gap-3 items-center">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-ink-100 overflow-hidden shrink-0">
                      {store.image_url ? (
                        <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-400">
                          <Icon.Store size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                        Pesanan dari
                      </p>
                      <h3 className="font-semibold text-sm md:text-base truncate text-ink-900">
                        {store.name}
                      </h3>
                      <p className="text-[11px] md:text-xs text-ink-500 line-clamp-1">{store.address}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Items */}
              <section className="mt-3 space-y-2.5">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-2xl bg-white border border-ink-200 p-3 md:p-4 flex gap-3 items-start fade-up"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-ink-100 overflow-hidden shrink-0">
                      {it.image ? (
                        <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-400">
                          <Icon.Coffee size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm md:text-base font-semibold text-ink-900 line-clamp-2">
                            {it.name}
                          </h4>
                          {it.variant && (
                            <p className="text-[11px] md:text-xs text-ink-500 line-clamp-2 mt-0.5">
                              {it.variant}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(it.id)}
                          className="text-ink-400 hover:text-red-500 p-1 -mr-1 -mt-1 shrink-0 transition"
                          aria-label="Hapus"
                          title="Hapus"
                        >
                          <Icon.Trash size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm md:text-base font-bold text-ink-900">
                          {rupiah(Number(it.orig_price || it.price) * it.qty)}
                        </span>
                        <div className="flex items-center gap-2 bg-ink-100 rounded-full p-1">
                          <button
                            onClick={() => updateQty(it.id, it.qty - 1)}
                            className="w-7 h-7 rounded-full bg-white border border-ink-200 hover:border-ink-900 text-ink-900 flex items-center justify-center font-semibold active:scale-90 transition"
                            aria-label="Kurangi"
                          >
                            −
                          </button>
                          <span className="text-sm font-semibold w-5 text-center text-ink-900">{it.qty}</span>
                          <button
                            onClick={() => tryIncrement(it)}
                            className="w-7 h-7 rounded-full bg-ink-900 hover:bg-ink-800 text-white flex items-center justify-center font-semibold active:scale-90 transition"
                            aria-label="Tambah"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            </div>

            {/* Summary */}
            <aside className="mt-4 md:mt-0">
              <div className="md:sticky md:top-20 space-y-3">
                {/* Warning kalau diskon dicap */}
                {discountCapped && (
                  <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-3 md:p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 text-white grid place-items-center text-lg shrink-0">
                      💡
                    </div>
                    <div className="flex-1 text-xs">
                      <p className="font-semibold text-emerald-700">Diskon mencapai batas maksimal</p>
                      <p className="text-emerald-700/80 mt-0.5 leading-relaxed">
                        Diskon dicap di Rp 35.000. <b>Pisah jadi 2 pesanan</b> agar dapat 2× potongan!
                      </p>
                    </div>
                  </div>
                )}

                {/* Promo info */}
                <div className="rounded-2xl border border-accent-200 bg-accent-50 p-3 md:p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-ink-900 text-accent-200 grid place-items-center shrink-0">
                    <Icon.Gift size={16} />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-accent-700">Diskon 50% diterapkan</p>
                    <p className="text-accent-600 mt-0.5">
                      Maksimal potongan {rupiah(DISCOUNT_MAX)}.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-ink-200 p-4 md:p-5">
                  <h3 className="text-sm font-semibold text-ink-900 mb-3">Ringkasan Tagihan</h3>
                  <div className="space-y-2 text-sm">
                    <Row label="Subtotal harga normal" value={rupiah(items.reduce((a, b) => a + Number(b.orig_price || b.price) * b.qty, 0))} valueClass="text-ink-400 line-through" />
                    <Row
                      label={
                        discountCapped
                          ? `Hemat 50% (maks ${rupiah(35000)})`
                          : 'Hemat 50%'
                      }
                      value={`- ${rupiah(discount)}`}
                      valueClass="text-emerald-600 font-semibold"
                    />
                    <Row label="Subtotal setelah diskon" value={rupiah(subtotal)} />
                    <Row label="Biaya jasa order" value={rupiah(serviceFee)} />
                  </div>
                  <div className="border-t border-ink-200 pt-3 mt-3 flex justify-between items-baseline">
                    <span className="font-semibold text-ink-900">Total</span>
                    <span className="font-bold text-xl text-ink-900">{rupiah(total)}</span>
                  </div>

                  <button
                    onClick={() => router.push('/checkout')}
                    className="hidden md:flex w-full mt-4 bg-ink-900 text-white rounded-2xl px-4 py-3.5 hover:bg-ink-800 active:scale-95 transition items-center justify-center gap-2 font-semibold text-sm"
                  >
                    Lanjut Checkout →
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Mobile checkout button */}
      {!empty && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-ink-200"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-md mx-auto px-4 pt-3">
            <button
              onClick={() => router.push('/checkout')}
              className="w-full bg-ink-900 text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-ink-900/20 hover:bg-ink-800 active:scale-[.98] flex items-center justify-between transition"
            >
              <span className="text-sm font-semibold">Lanjut Checkout</span>
              <span className="text-sm font-bold">{rupiah(total)} →</span>
            </button>
          </div>
        </div>
      )}

      <DiscountCapModal
        open={capModal.open}
        mode={capModal.mode}
        lostSaving={capModal.lostSaving}
        max={DISCOUNT_MAX}
        onCancel={handleCapCancel}
        onConfirm={handleCapConfirm}
      />
    </main>
  );
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={valueClass || 'text-ink-900 font-medium'}>{value}</span>
    </div>
  );
}
