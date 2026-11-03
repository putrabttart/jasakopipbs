'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icons';

const ADMIN_WA = '6281291544061';

function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

export default function OrderConfirmedPage({ params }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(params.id)}`);
      const json = await res.json();
      if (json.error_code === 0 && json.data) {
        setOrder(json.data);
      } else {
        setError('Pesanan tidak ditemukan');
      }
    } catch (_) {
      setError('Gagal memuat pesanan');
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#E0EEEE' }}>
        <TopBar title="Pickup" />
        <div className="max-w-md mx-auto px-4 mt-8 space-y-3">
          <div className="h-32 rounded-3xl shimmer" />
          <div className="h-48 rounded-2xl shimmer" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-ink-50">
        <TopBar title="Pickup" />
        <div className="max-w-md mx-auto px-4 mt-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 grid place-items-center text-red-600 mb-4">
            <Icon.AlertTriangle size={28} />
          </div>
          <p className="font-semibold text-ink-900">{error}</p>
        </div>
      </main>
    );
  }

  const d = order?.data || {};
  const items = d.items || [];
  const status = order?.status || 'processing';
  const pickupNumber = d.pickup_number || null;

  const isProcessing = status === 'processing' || status === 'pending';
  const isReady = status === 'ready';
  const isDone = status === 'done';

  return (
    <main className="min-h-screen pb-8" style={{ backgroundColor: '#E0EEEE' }}>
      <TopBar title="Pickup" />

      <div className="max-w-md mx-auto px-5 pt-2">
        {/* Timeline 3 step */}
        <div className="flex items-start justify-between px-2 mt-2">
          <TimelineStep
            label1="Sedang"
            label2="Diproses"
            icon={<RefreshIcon />}
            state={isProcessing ? 'active' : 'done'}
          />
          <TimelineLine done={isReady || isDone} />
          <TimelineStep
            label1="Siap"
            label2="Di-Pickup"
            icon={<BoxIcon />}
            state={isReady ? 'active' : isDone ? 'done' : 'idle'}
            highlight={isReady}
          />
          <TimelineLine done={isDone} />
          <TimelineStep
            label1="Pesanan"
            label2="Selesai"
            icon={<Icon.Check size={20} strokeWidth={3} />}
            state={isDone ? 'active' : 'idle'}
          />
        </div>

        {/* Nomor Order */}
        {pickupNumber && (
          <div className="text-center mt-6">
            <p className="text-sm font-semibold text-ink-700">Nomor Order</p>
            <p className="text-5xl font-extrabold text-ink-900 tracking-tight mt-1">
              {pickupNumber}
            </p>
          </div>
        )}

        {!pickupNumber && (
          <div className="text-center mt-7">
            <p className="text-sm text-ink-700">
              {isProcessing
                ? 'Pesanan kamu sedang diproses'
                : isDone
                ? 'Pesanan kamu sudah selesai'
                : 'Menunggu nomor order...'}
            </p>
          </div>
        )}

        {/* Status Card */}
        <div className="mt-5 rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-base font-bold text-ink-900">
            {isReady
              ? 'Pesanan Sudah Siap'
              : isProcessing
              ? 'Pesanan Diproses'
              : 'Pesanan Selesai'}
          </p>
          <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
            {isReady
              ? 'Tunjukkan nomor order diatas untuk pickup pesanan kamu'
              : isProcessing
              ? 'Tunggu sebentar ya, kami sedang menyiapkan pesanan kamu'
              : 'Terima kasih sudah order, sampai jumpa lagi!'}
          </p>
          <div className="mt-4 h-1 bg-ink-100 rounded-full overflow-hidden">
            <div
              className={
                'h-full rounded-full transition-all ' +
                (isDone ? 'bg-emerald-500 w-full' : isReady ? 'bg-emerald-500 w-3/4' : 'bg-blue-400 w-2/5 animate-pulse')
              }
            />
          </div>
        </div>

        {/* Detail Pesanan */}
        <div className="mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon.Receipt size={14} className="text-ink-500" />
              <span className="text-sm font-bold text-ink-900">Detail Pesanan</span>
            </div>
            {order.created_at && (
              <span className="text-[11px] text-ink-500">
                {new Date(order.created_at).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            <DetailRow icon={<Icon.User size={14} />} label="Nama Pelanggan" value={(d.customer?.name || '-').toUpperCase()} bold />

            {d.store && (
              <DetailRow
                icon={<Icon.Pin size={14} />}
                label="Outlet"
                value={
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{d.store.name}</p>
                    <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">{d.store.address}</p>
                  </div>
                }
              />
            )}

            <div className="pt-3 border-t border-ink-100">
              <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
                Pesanan ({items.reduce((a, b) => a + (b.qty || 0), 0)} item)
              </p>
              <ul className="space-y-2">
                {items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    {(it.image || it.m) && (
                      <img
                        src={it.image || it.m}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate">
                        {it.name || it.n}
                      </p>
                      {(it.variant || it.v) && (
                        <p className="text-[10px] text-ink-500 truncate">{it.variant || it.v}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-ink-700 shrink-0">
                      {it.qty || it.q}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between items-baseline pt-3 border-t border-ink-100">
              <span className="text-xs text-ink-500">Total Bayar</span>
              <span className="text-base font-extrabold text-ink-900">
                {rupiah(d.totalToPay || d.total)}
              </span>
            </div>
          </div>
        </div>

        {/* WhatsApp button */}
        <a
          href={`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
            `Halo Admin, saya ingin tanya tentang pesanan ${order.id}.`
          )}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 w-full bg-white border-2 border-amber-700 text-amber-800 rounded-2xl px-4 py-3 active:scale-[.98] transition flex items-center justify-center gap-2 font-semibold text-sm hover:bg-amber-50"
        >
          Bantuan via WhatsApp
        </a>
      </div>
    </main>
  );
}

function TopBar({ title }) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="max-w-md mx-auto flex items-center">
        <Link
          href="/"
          className="w-10 h-10 grid place-items-center -ml-2 text-ink-900"
          aria-label="Kembali"
        >
          <Icon.ChevronLeft size={22} />
        </Link>
        <h1 className="flex-1 text-center text-xl font-bold text-ink-900 -ml-10">
          {title}
        </h1>
      </div>
    </div>
  );
}

function TimelineStep({ label1, label2, icon, state, highlight }) {
  // state: 'idle' | 'active' | 'done'
  const ringClass =
    state === 'active'
      ? 'bg-amber-700 text-white border-amber-700'
      : state === 'done'
      ? 'bg-white text-amber-700 border-amber-700'
      : 'bg-white text-ink-300 border-ink-300';

  const labelClass =
    state === 'idle' ? 'text-ink-400' : 'text-ink-700';

  return (
    <div className="flex flex-col items-center z-10">
      <div
        className={
          'w-14 h-14 rounded-full grid place-items-center border-2 transition ' + ringClass
        }
      >
        {icon}
      </div>
      <div className="mt-1.5 text-center">
        <p className={'text-xs leading-tight font-semibold ' + labelClass}>{label1}</p>
        <p className={'text-xs leading-tight font-semibold ' + labelClass}>{label2}</p>
      </div>
    </div>
  );
}

function TimelineLine({ done }) {
  return (
    <div className="flex-1 mt-7 mx-1">
      <div
        className={'h-0.5 transition ' + (done ? 'bg-amber-700' : 'bg-ink-300')}
      />
    </div>
  );
}

function DetailRow({ icon, label, value, bold }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-ink-400 mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
          {label}
        </p>
        {typeof value === 'string' ? (
          <p
            className={
              'mt-0.5 ' + (bold ? 'text-base font-bold text-ink-900' : 'text-sm text-ink-900')
            }
          >
            {value}
          </p>
        ) : (
          <div className="mt-0.5">{value}</div>
        )}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
