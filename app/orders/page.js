'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Icon } from '@/components/Icons';

const STORAGE_KEY = 'jasdor-my-orders';

function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

const STATUS_MAP = {
  pending: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  done: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyOrders();
  }, []);

  async function loadMyOrders() {
    setLoading(true);
    try {
      const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch each order
      const results = await Promise.all(
        ids.slice(0, 20).map(async (id) => {
          try {
            const res = await fetch(`/api/orders/${encodeURIComponent(id)}`);
            const json = await res.json();
            if (json.error_code === 0 && json.data) return json.data;
          } catch (_) {}
          return null;
        })
      );

      setOrders(results.filter(Boolean).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ));
    } catch (_) {}
    setLoading(false);
  }

  return (
    <main className="pb-24">
      <Header title="Pesanan Saya" subtitle="Riwayat" back="/" />

      <div className="max-w-3xl mx-auto px-4 md:px-6 mt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl shimmer" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-ink-100 grid place-items-center text-ink-400 mb-4">
              <Icon.Receipt size={36} />
            </div>
            <p className="font-semibold text-lg text-ink-900">Belum ada pesanan</p>
            <p className="text-sm text-ink-500 mt-1">
              Pesanan yang kamu buat akan muncul di sini.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-5 bg-ink-900 text-white text-sm font-semibold px-6 py-3 rounded-2xl hover:bg-ink-800 active:scale-95 transition"
            >
              Mulai Pesan
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const d = order.data || {};
              const items = d.items || [];
              const totalQty = items.reduce((a, b) => a + (b.qty || 0), 0);
              const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending;
              const createdAt = order.created_at
                ? new Date(order.created_at).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                : '';

              const unpaid =
                order.status === 'pending' && !d.proof_url;
              const detailHref =
                order.status === 'ready' || order.status === 'done'
                  ? `/order/confirmed/${order.id}`
                  : `/order/${order.id}`;

              return (
                <div
                  key={order.id}
                  className={
                    'rounded-2xl bg-white border overflow-hidden transition ' +
                    (unpaid
                      ? 'border-amber-300 shadow-amber-100/50 shadow-md'
                      : 'border-ink-200 hover:border-ink-900 hover:shadow-card')
                  }
                >
                  <Link
                    href={detailHref}
                    className="block p-4 active:scale-[.99] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-ink-900">{order.id}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-ink-500 mt-1">
                          {d.store?.name || 'Outlet'} • {totalQty} item
                        </p>
                        <p className="text-[10px] text-ink-400 mt-0.5">{createdAt}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-ink-900">
                          {rupiah(d.totalToPay || d.total)}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-ink-400">
                          <span className="text-[10px]">Detail</span>
                          <Icon.ChevronRight size={12} />
                        </div>
                      </div>
                    </div>

                    {/* Item thumbnails */}
                    {items.length > 0 && (
                      <div className="flex gap-1.5 mt-3 overflow-hidden">
                        {items.slice(0, 4).map((it, i) => (
                          <div key={i} className="w-10 h-10 rounded-lg bg-ink-100 overflow-hidden shrink-0">
                            {(it.image || it.m) ? (
                              <img src={it.image || it.m} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full grid place-items-center text-ink-400">
                                <Icon.Coffee size={14} />
                              </div>
                            )}
                          </div>
                        ))}
                        {items.length > 4 && (
                          <div className="w-10 h-10 rounded-lg bg-ink-100 grid place-items-center text-[10px] font-bold text-ink-600 shrink-0">
                            +{items.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </Link>

                  {/* Tombol bayar sekarang untuk order belum bayar */}
                  {unpaid && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-2 mb-2">
                        <Icon.AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        <p className="text-[11px] text-amber-800 font-medium flex-1">
                          Pesanan belum dibayar
                        </p>
                      </div>
                      <Link
                        href={`/payment/${order.id}`}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold py-3 rounded-xl active:scale-[.98] transition flex items-center justify-center gap-2"
                      >
                        <Icon.Tag size={14} />
                        Bayar Sekarang
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// Helper: simpan order ID ke localStorage
export function saveOrderToHistory(orderId) {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!ids.includes(orderId)) {
      ids.unshift(orderId);
      // Keep max 50
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 50)));
    }
  } catch (_) {}
}
