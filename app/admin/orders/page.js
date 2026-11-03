'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Icon } from '@/components/Icons';

function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

const STATUS_MAP = {
  pending: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ready: { label: 'Siap Pickup', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  done: { label: 'Selesai', color: 'bg-ink-100 text-ink-600 border-ink-200' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function AdminOrdersPage() {
  return (
    <AdminLayout title="Pesanan">
      <OrdersContent />
    </AdminLayout>
  );
}

function OrdersContent() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const pw = sessionStorage.getItem('admin-auth') || '';
      const res = await fetch('/api/orders', {
        headers: { 'x-admin-password': pw },
      });
      const json = await res.json();
      if (json.error_code === 0) {
        setOrders(json.data || []);
      }
    } catch (_) {}
    setLoading(false);
  }

  async function updateStatus(orderId, status, extra = {}) {
    const pw = sessionStorage.getItem('admin-auth') || '';
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pw,
        },
        body: JSON.stringify({ status, ...extra }),
      });
      const json = await res.json();
      if (json.error_code === 0) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status,
                  data: extra.pickup_number
                    ? { ...o.data, pickup_number: extra.pickup_number }
                    : o.data,
                }
              : o
          )
        );
      }
    } catch (_) {}
  }

  const filtered =
    filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    done: orders.filter((o) => o.status === 'done').length,
  };

  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Pesanan Masuk</h1>
          <p className="text-xs text-ink-500">{counts.pending} pesanan menunggu</p>
        </div>
        <button
          onClick={loadOrders}
          className="w-10 h-10 rounded-full bg-white border border-ink-200 hover:border-ink-900 grid place-items-center text-ink-700 transition"
          aria-label="Refresh"
        >
          <Icon.Spinner size={14} className="animate-none" />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: 'all', label: 'Semua', count: counts.all },
          { key: 'pending', label: 'Menunggu', count: counts.pending },
          { key: 'processing', label: 'Diproses', count: counts.processing },
          { key: 'ready', label: 'Siap Pickup', count: counts.ready },
          { key: 'done', label: 'Selesai', count: counts.done },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={
              'shrink-0 text-xs font-semibold px-4 py-2 rounded-full transition active:scale-95 inline-flex items-center gap-1.5 ' +
              (filter === s.key
                ? 'bg-ink-900 text-white'
                : 'bg-white text-ink-700 border border-ink-200 hover:border-ink-400')
            }
          >
            {s.label}
            <span
              className={
                'text-[10px] px-1.5 rounded-full ' +
                (filter === s.key ? 'bg-white/20' : 'bg-ink-100')
              }
            >
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-ink-200 p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-ink-100 grid place-items-center text-ink-400 mb-3">
            <Icon.Receipt size={24} />
          </div>
          <p className="text-sm font-semibold text-ink-900">Belum ada pesanan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [pickupNumber, setPickupNumber] = useState('');
  const d = order.data || {};
  const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const items = d.items || [];
  const totalQty = items.reduce((a, b) => a + (b.qty || 0), 0);
  const createdAt = order.created_at
    ? new Date(order.created_at).toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';

  const customerWa = d.customer?.phone
    ? d.customer.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')
    : '';

  function handleReadyClick() {
    setPickupNumber('');
    setShowPickupDialog(true);
  }

  function confirmReady() {
    if (!pickupNumber.trim()) return;
    onStatusChange(order.id, 'ready', { pickup_number: pickupNumber.trim() });
    setShowPickupDialog(false);
    // Notifikasi ke customer dikirim otomatis oleh bot WA via Supabase Realtime
  }

  return (
    <div className="rounded-2xl bg-white border border-ink-200 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-ink-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink-900">{order.id}</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.color}`}
            >
              {statusInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-ink-500">
            <span>{d.customer?.name || '-'}</span>
            <span>{totalQty} item</span>
            <span className="font-semibold text-ink-900">{rupiah(d.totalToPay || d.total)}</span>
          </div>
          <p className="text-[10px] text-ink-400 mt-0.5">{createdAt}</p>
        </div>
        <Icon.ChevronRight
          size={16}
          className={`text-ink-400 transition ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-ink-100 p-4 space-y-3 fade-up">
          {/* Customer */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="text-ink-500">Pelanggan</p>
              <p className="font-semibold text-ink-900">{d.customer?.name || '-'}</p>
              <p className="text-ink-500">{d.customer?.phone || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-ink-500">Waktu Ambil</p>
              <p className="font-semibold text-ink-900">
                {d.pickup?.type === 'later' ? `Pukul ${d.pickup.time}` : 'Sekarang'}
              </p>
            </div>
          </div>

          {/* Store */}
          {d.store && (
            <div className="text-xs">
              <p className="text-ink-500">Outlet</p>
              <p className="font-semibold text-ink-900">{d.store.name}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {it.image && (
                  <img
                    src={it.image}
                    alt={it.name}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 truncate">{it.name}</p>
                  {it.variant && (
                    <p className="text-[10px] text-ink-500 truncate">{it.variant}</p>
                  )}
                </div>
                <span className="text-ink-700 font-medium shrink-0">
                  {it.qty}× {rupiah(it.price)}
                </span>
              </div>
            ))}
          </div>

          {/* Bukti bayar */}
          {d.proof_url && (
            <div className="pt-2 border-t border-ink-100">
              <p className="text-[10px] text-ink-500 font-semibold mb-1.5">Bukti Bayar</p>
              <img
                src={d.proof_url}
                alt="Bukti bayar"
                className="w-full max-h-40 object-contain rounded-xl border border-ink-200 bg-ink-50"
              />
            </div>
          )}

          {/* Payment status indicator */}
          {!d.proof_url && order.status === 'pending' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-2">
              <Icon.Clock size={14} className="text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-700 font-medium">
                Menunggu pembayaran dari pelanggan
              </p>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-baseline pt-2 border-t border-ink-100 text-sm">
            <span className="text-ink-500">Total</span>
            <span className="font-bold text-ink-900">{rupiah(d.totalToPay || d.total)}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {order.status === 'pending' && (
              <button
                onClick={() => onStatusChange(order.id, 'processing')}
                disabled={!d.proof_url}
                className="text-xs bg-blue-500 text-white px-3 py-2 rounded-xl font-semibold hover:bg-blue-600 disabled:bg-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed transition"
                title={!d.proof_url ? 'Menunggu bukti bayar' : ''}
              >
                {d.proof_url ? 'Proses' : 'Belum bayar'}
              </button>
            )}
            {order.status === 'processing' && (
              <button
                onClick={handleReadyClick}
                className="text-xs bg-emerald-500 text-white px-3 py-2 rounded-xl font-semibold hover:bg-emerald-600 transition inline-flex items-center gap-1"
              >
                <Icon.Check size={12} strokeWidth={3} />
                Siap Pickup
              </button>
            )}
            {order.status === 'ready' && (
              <>
                <button
                  onClick={() => onStatusChange(order.id, 'done')}
                  className="text-xs bg-ink-900 text-white px-3 py-2 rounded-xl font-semibold hover:bg-ink-800 transition"
                >
                  Selesai
                </button>
                {d.pickup_number && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-2 rounded-xl font-bold inline-flex items-center gap-1">
                    No. {d.pickup_number}
                  </span>
                )}
              </>
            )}
            {(order.status === 'pending' || order.status === 'processing') && (
              <button
                onClick={() => onStatusChange(order.id, 'cancelled')}
                className="text-xs bg-white border border-red-200 text-red-600 px-3 py-2 rounded-xl font-semibold hover:bg-red-50 transition"
              >
                Batalkan
              </button>
            )}
            <Link
              href={`/order/${order.id}`}
              target="_blank"
              className="text-xs bg-ink-100 text-ink-900 px-3 py-2 rounded-xl font-semibold hover:bg-ink-200 transition inline-flex items-center gap-1"
            >
              <Icon.ExternalLink size={12} />
              Detail
            </Link>
            {customerWa && (
              <a
                href={`https://wa.me/${customerWa}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl font-semibold hover:bg-emerald-100 transition inline-flex items-center gap-1"
              >
                <Icon.WhatsApp size={12} />
                Chat
              </a>
            )}
          </div>
        </div>
      )}

      {/* Pickup number dialog */}
      {showPickupDialog && (
        <PickupDialog
          orderId={order.id}
          customerName={d.customer?.name}
          value={pickupNumber}
          onChange={setPickupNumber}
          onCancel={() => setShowPickupDialog(false)}
          onConfirm={confirmReady}
        />
      )}
    </div>
  );
}

function PickupDialog({ orderId, customerName, value, onChange, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden fade-up">
        <div className="px-6 pt-6 pb-4 text-center border-b border-ink-100">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 grid place-items-center text-emerald-600 mb-3">
            <Icon.Check size={26} strokeWidth={3} />
          </div>
          <h2 className="text-lg font-bold text-ink-900">Siap di-Pickup</h2>
          <p className="text-xs text-ink-500 mt-1">
            Masukkan nomor order untuk pelanggan {customerName ? <b>{customerName}</b> : ''}
          </p>
        </div>

        <div className="p-6">
          <label className="text-xs font-semibold text-ink-900">Nomor Order</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="cth: 015"
            inputMode="numeric"
            className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3.5 text-2xl font-extrabold text-center tracking-widest text-ink-900 outline-none focus:border-ink-900 focus:bg-white transition"
            autoFocus
          />
          <p className="text-[10px] text-ink-500 mt-1.5">
            Nomor ini akan dikirim ke pelanggan otomatis oleh bot WA.
          </p>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <button
              onClick={onCancel}
              className="bg-white border border-ink-200 hover:border-ink-900 text-ink-700 text-sm font-medium py-3 rounded-2xl transition"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={!value.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-ink-300 text-white text-sm font-semibold py-3 rounded-2xl transition active:scale-[.98]"
            >
              Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
