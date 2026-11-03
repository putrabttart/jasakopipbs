'use client';

import Link from 'next/link';
import { useCart } from './CartContext';
import { Icon } from './Icons';

export default function Header({ title, subtitle, back, showCart = true }) {
  const { totalQty } = useCart();

  return (
    <header className="sticky top-0 z-30 glass border-b border-ink-200">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {back && (
            <Link
              href={back}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-100 active:scale-95 transition shrink-0"
              aria-label="Kembali"
            >
              <Icon.ChevronLeft size={20} />
            </Link>
          )}

          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white border border-ink-200 grid place-items-center shrink-0 overflow-hidden">
              <img
                src="https://cdn.kopikenangan.com/image/new_home/kopi-kenangan-v2.png"
                alt="Kopi Kenangan"
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-semibold leading-none">
                {subtitle || 'JasdorAja'}
              </p>
              <h1 className="text-sm md:text-base font-semibold text-ink-900 truncate leading-tight mt-0.5">
                {title || 'Jasa Order Kopi Kenangan'}
              </h1>
            </div>
          </Link>
        </div>

        {showCart && (
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-100 active:scale-95 transition text-ink-700"
              aria-label="Riwayat Pesanan"
            >
              <Icon.Receipt size={18} />
            </Link>
            <Link
              href="/cart"
              className="relative w-11 h-11 flex items-center justify-center rounded-full bg-ink-900 text-white hover:bg-ink-800 active:scale-95 transition shrink-0"
              aria-label="Keranjang"
            >
              <Icon.Cart size={18} />
              {totalQty > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent-400 text-ink-900 text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold border-2 border-ink-50">
                  {totalQty}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
