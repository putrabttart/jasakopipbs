'use client';

import Link from 'next/link';
import { useCart } from './CartContext';
import { Icon } from './Icons';

export default function Header({ title, subtitle, back, showCart = true }) {
  const { totalQty } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-[#f7f6f2]/95 backdrop-blur-xl border-b border-black/5">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-[72px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {back && (
            <Link
              href={back}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-ink-200 bg-white hover:border-ink-400 active:scale-95 transition shrink-0"
              aria-label="Kembali"
            >
              <Icon.ChevronLeft size={20} />
            </Link>
          )}

          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            <div className="w-10 h-10 rounded-full bg-ink-900 text-white grid place-items-center shrink-0 group-hover:bg-accent-700 transition">
              <Icon.Coffee size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.24em] text-ink-500 font-semibold leading-none">
                {subtitle || 'Jasa Order Kopi'}
              </p>
              <h1 className="text-sm md:text-[15px] font-bold text-ink-900 truncate leading-tight mt-1">
                {title || 'Jasdor PBS'}
              </h1>
            </div>
          </Link>
        </div>

        {showCart && (
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white active:scale-95 transition text-ink-700"
              aria-label="Riwayat Pesanan"
            >
              <Icon.Receipt size={18} />
            </Link>
            <Link
              href="/cart"
              className="relative h-10 px-4 flex items-center justify-center rounded-full bg-ink-900 text-white hover:bg-ink-800 active:scale-95 transition shrink-0"
              aria-label="Keranjang"
            >
              <Icon.Cart size={18} />
              {totalQty > 0 && (
                <span className="absolute -top-1.5 -right-1 bg-white text-ink-900 text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold border border-ink-200 shadow-soft">
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
