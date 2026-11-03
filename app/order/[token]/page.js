'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { decodeOrder } from '@/components/orderEncode';
import { Icon } from '@/components/Icons';

function rupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
}

export default function OrderDetailPage({ params }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const pw = sessionStorage.getItem('admin-auth');
    if (pw) setIsAdmin(true);
    loadOrder();
  }, [params.token]);

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(params.token)}`);
      const json = await res.json();
      if (json.error_code === 0 && json.data) {
        const d = json.data.data || json.data;
        setOrder({
          ...d,
          orderId: d.orderId || json.data.id,
          createdAt: d.createdAt || json.data.created_at,
          proof_url: d.proof_url || '',
          status: json.data.status || 'pending',
        });
        return;
      }
    } catch (_) {}

    const decoded = decodeOrder(params.token);
    if (decoded) {
      setOrder({ ...decoded, status: 'pending' });
      return;
    }

    setError('Pesanan tidak ditemukan.');
  }

  function copyLink() {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (error) {
    return (
      <main className="pb-24">
        <Header title="Detail Pesanan" back="/" showCart={false} />
        <div className="max-w-md mx-auto px-4 mt-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-100 grid place-items-center text-red-600 mb-4">
            <Icon.AlertTriangle size={32} />
          </div>
          <p className="font-semibold text-lg text-ink-900">{error}</p>
          <Link
            href="/"
            className="inline-flex mt-5 bg-ink-900 text-white text-sm font-semibold px-6 py-3 rounded-2xl hover:bg-ink-800 transition"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="pb-24">
        <Header title="Detail Pesanan" back="/" showCart={false} />
        <div className="max-w-3xl mx-auto px-4 md:px-6 mt-6 space-y-3">
          <div className="h-32 rounded-3xl shimmer" />
          <div className="grid md:grid-cols-2 gap-3">
            <div className="h-28 rounded-2xl shimmer" />
            <div className="h-28 rounded-2xl shimmer" />
          </div>
          <div className="h-48 rounded-2xl shimmer" />
        </div>
      </main>
    );
  }

  const {
    orderId,
    customer,
    pickup,
    store,
    items = [],
    subtotal,
    origSubtotal,
    discount,
    discountCapped,
    serviceFee,
    total,
    createdAt,
    proof_url,
  } = order;

  const customerWa = customer?.phone ? customer.phone.replace(/[^0-9]/g, '').replace(/^0/, '62') : '';
  const dateStr = formatDateTime(createdAt);
  const totalQty = items.reduce((a, b) => a + (b.qty || 0), 0);
  const orderStatus = order.status || order._status || 'pending';

  return (
    <main className="pb-24 bg-ink-50/50">
      <Header title="Detail Pesanan" subtitle={orderId} back="/" showCart={false} />

      <div className="max-w-3xl mx-auto px-4 md:px-6">
        {/* Hero status */}
        <section className="mt-4 md:mt-6">
          <div className={'relative rounded-3xl text-white p-6 md:p-8 overflow-hidden ' + getStatusBg(orderStatus)}>
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/15 backdrop-blur px-3 py-1 rounded-full">
                    <span className={'w-1.5 h-1.5 rounded-full ' + getStatusDot(orderStatus)} />
                    {getStatusLabel(orderStatus)}
                  </span>
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-70 font-semibold mt-3">
                    Order ID
                  </p>
                  <p className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight">
                    {orderId}
                  </p>
                  {dateStr && (
                    <p className="text-xs md:text-sm opacity-80 mt-1">{dateStr}</p>
                  )}
                </div>
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
                  {getStatusIcon(orderStatus)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-white/15">
                <Stat label="Item" value={totalQty} />
                <Stat
                  label="Pengambilan"
                  value={pickup?.type === 'later' ? pickup.time || '-' : 'Segera'}
                />
                <Stat label="Total" value={rupiah(order.totalToPay || total)} highlight />
              </div>
            </div>
          </div>
        </section>

        {/* Action bar - admin only */}
        {isAdmin && (
          <section className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={copyLink}
              className="bg-white border border-ink-200 hover:border-ink-900 text-ink-900 text-xs md:text-sm font-medium py-3 rounded-2xl transition flex items-center justify-center gap-2"
            >
              {copied ? <><Icon.Check size={14} /> Tersalin</> : <><Icon.Copy size={14} /> Salin Link</>}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white border border-ink-200 hover:border-ink-900 text-ink-900 text-xs md:text-sm font-medium py-3 rounded-2xl transition flex items-center justify-center gap-2"
            >
              <Icon.Print size={14} /> Cetak
            </button>
          </section>
        )}

        {/* Customer + Pickup */}
        <section className="mt-3 grid md:grid-cols-2 gap-3">
          {isAdmin && (
            <Card title="Pelanggan" icon={<Icon.User size={16} />}>
              <Info label="Nama" value={customer?.name || '-'} />
              <Info
                label="WhatsApp"
                value={
                  customer?.phone ? (
                    <a href={`https://wa.me/${customerWa}`} target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1">
                      {customer.phone} <Icon.ExternalLink size={11} />
                    </a>
                  ) : '-'
                }
              />
            </Card>
          )}

          <Card title="Waktu Ambil" icon={<Icon.Clock size={16} />}>
            <div className="flex items-center gap-3">
              <div className={'w-12 h-12 rounded-2xl grid place-items-center shrink-0 ' + (pickup?.type === 'later' ? 'bg-accent-100 text-accent-600' : 'bg-emerald-100 text-emerald-600')}>
                {pickup?.type === 'later' ? <Icon.Clock size={22} /> : <Icon.Bolt size={22} />}
              </div>
              <div>
                <p className="font-semibold text-ink-900">{pickup?.type === 'later' ? 'Ambil Nanti' : 'Ambil Sekarang'}</p>
                <p className="text-xs text-ink-500 mt-0.5">{pickup?.type === 'later' ? `Pukul ${pickup.time || '-'}` : 'Secepatnya'}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Outlet & Delivery */}
        {store && (
          <section className="mt-3">
            <Card title={order.orderType === 'delivery' ? 'Pengiriman' : 'Outlet'} icon={<Icon.Pin size={16} />}>
              <p className="font-semibold text-ink-900">{store.name}</p>
              <p className="text-xs text-ink-500 mt-1">{store.address}</p>
              {order.orderType === 'delivery' && order.deliveryAddress && (
                <div className="mt-3 pt-3 border-t border-ink-100">
                  <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                    Dikirim ke
                  </p>
                  <p className="text-sm text-ink-900 mt-0.5 leading-relaxed">{order.deliveryAddress}</p>
                  {order.deliveryLocation?.lat && (
                    <a
                      href={`https://www.google.com/maps?q=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                    >
                      <Icon.Pin size={12} />
                      Buka di Google Maps
                      <Icon.ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Items */}
        <section className="mt-3">
          <Card title="Daftar Pesanan" icon={<Icon.List size={16} />} badge={`${items.length} produk`}>
            <ul className="divide-y divide-ink-100">
              {items.map((it, i) => (
                <li key={i} className="py-3 first:pt-0 last:pb-0 flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-ink-100 overflow-hidden shrink-0">
                    {(it.image || it.m) ? (
                      <img src={it.image || it.m} alt={it.name || it.n} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-ink-400"><Icon.Coffee size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-ink-900 text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full grid place-items-center shrink-0">{it.qty || it.q}×</span>
                      <p className="font-semibold text-sm text-ink-900 truncate">{it.name || it.n}</p>
                    </div>
                    {(it.variant || it.v) && <p className="text-[11px] text-ink-500 mt-1 line-clamp-2">{it.variant || it.v}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ink-900">{rupiah((it.price || it.p) * (it.qty || it.q))}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Proof - admin only */}
        {proof_url && isAdmin && (
          <section className="mt-3">
            <Card title="Bukti Bayar" icon={<Icon.Check size={16} />}>
              <img src={proof_url} alt="Bukti bayar" className="w-full max-h-64 object-contain rounded-xl border border-ink-200 bg-ink-50" />
            </Card>
          </section>
        )}

        {/* Bill */}
        <section className="mt-3">
          <div className="rounded-2xl bg-white border border-ink-200 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-ink-100 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-ink-100 grid place-items-center text-ink-700"><Icon.Receipt size={16} /></span>
              <h3 className="text-sm font-semibold text-ink-900">Ringkasan Tagihan</h3>
            </div>

            <div className="px-4 py-4">
              {/* Group: Harga & diskon */}
              <div className="space-y-1.5">
                {origSubtotal > subtotal && (
                  <Row
                    label="Harga normal"
                    value={rupiah(origSubtotal)}
                    valueClass="text-ink-400 line-through text-xs"
                  />
                )}
                {discount > 0 && (
                  <Row
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        Hemat 50%
                        {discountCapped && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                            MAX
                          </span>
                        )}
                      </span>
                    }
                    value={`- ${rupiah(discount)}`}
                    valueClass="text-emerald-600 font-semibold text-xs"
                  />
                )}
              </div>

              {/* Group: Subtotal & fee */}
              <div className="space-y-1.5 mt-3 pt-3 border-t border-dashed border-ink-200">
                <Row
                  label="Subtotal"
                  value={rupiah(subtotal)}
                  labelClass="text-ink-700"
                  valueClass="text-ink-900 font-medium text-sm"
                />
                <Row
                  label="Biaya jasa order"
                  value={rupiah(serviceFee)}
                  labelClass="text-ink-700"
                  valueClass="text-ink-900 font-medium text-sm"
                />
                {order.orderType === 'delivery' && order.deliveryFee > 0 && (
                  <Row
                    label="Biaya delivery"
                    value={rupiah(order.deliveryFee)}
                    labelClass="text-ink-700"
                    valueClass="text-ink-900 font-medium text-sm"
                  />
                )}
                {order.uniqueCode != null && (
                  <Row
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        Kode unik
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                          VERIFIKASI
                        </span>
                      </span>
                    }
                    value={`+ ${order.uniqueCode}`}
                    labelClass="text-ink-700"
                    valueClass="text-amber-600 font-semibold text-sm"
                  />
                )}
              </div>
            </div>

            {/* Total bayar */}
            <div className="px-4 py-4 bg-ink-900 text-white flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                  Total Bayar
                </p>
              </div>
              <p className="font-extrabold text-2xl tracking-tight">
                {rupiah(order.totalToPay || total)}
              </p>
            </div>
          </div>
        </section>

        {/* Admin actions */}
        {isAdmin && customer?.phone && (
          <AdminActions
            order={order}
            orderId={orderId || params.token}
            customerWa={customerWa}
            customerName={customer?.name}
          />
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">{label}</p>
      <p className={'mt-1 ' + (highlight ? 'text-base md:text-lg font-extrabold text-accent-200' : 'text-base md:text-lg font-bold')}>{value}</p>
    </div>
  );
}

function Card({ title, icon, badge, children }) {
  return (
    <div className="rounded-2xl bg-white border border-ink-200 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-ink-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-ink-100 grid place-items-center text-ink-700 shrink-0">{icon}</span>
          <h3 className="text-sm font-semibold text-ink-900 truncate">{title}</h3>
        </div>
        {badge && <span className="text-[10px] bg-ink-100 text-ink-700 px-2 py-1 rounded-full font-semibold shrink-0">{badge}</span>}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-ink-100 last:border-0 text-sm">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className="text-ink-900 font-medium text-right min-w-0">{value}</span>
    </div>
  );
}

function Row({ label, value, valueClass = '', labelClass = '' }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={labelClass || 'text-ink-500'}>{label}</span>
      <span className={valueClass || 'text-ink-900 font-medium'}>{value}</span>
    </div>
  );
}

function AdminActions({ order, orderId, customerWa, customerName }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const pw = sessionStorage.getItem('admin-auth');
    if (pw) setIsAdmin(true);
  }, []);

  async function handleAccept() {
    setAccepting(true);
    const pw = sessionStorage.getItem('admin-auth') || '';
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pw,
        },
        body: JSON.stringify({ status: 'processing' }),
      });
      const json = await res.json();
      if (json.error_code === 0) {
        setAccepted(true);
        // Kirim link konfirmasi ke user via WA
        sendConfirmationWA();
      }
    } catch (_) {}
    setAccepting(false);
  }

  function sendConfirmationWA() {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const confirmUrl = `${baseUrl}/order/confirmed/${orderId}`;

    const message = [
      `Halo ${customerName || 'Kak'}, pesanan kamu sudah dikonfirmasi!`,
      ``,
      `Order: ${orderId}`,
      `Total: ${rupiah(order.total)}`,
      ``,
      `Lihat detail pesanan:`,
      confirmUrl,
      ``,
      `Terima kasih sudah order di Jasa Order Kopi Kenangan.`,
    ].join('\n');

    const waUrl = `https://wa.me/${customerWa}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  return (
    <section className="mt-4 space-y-2">
      {/* Admin: Terima pesanan */}
      {isAdmin && !accepted && (
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-ink-300 text-white rounded-2xl px-4 py-3.5 active:scale-[.98] transition flex items-center justify-center gap-2 font-semibold text-sm"
        >
          {accepting ? <Icon.Spinner size={14} /> : <Icon.Check size={18} />}
          Terima Pesanan & Kirim Konfirmasi
        </button>
      )}

      {isAdmin && accepted && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-700">
            <Icon.Check size={18} />
            <p className="text-sm font-semibold">Pesanan diterima & konfirmasi terkirim</p>
          </div>
        </div>
      )}

      {/* Contact buttons */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/${customerWa}`}
          target="_blank"
          rel="noreferrer"
          className="bg-white border border-ink-200 hover:border-emerald-500 text-ink-900 rounded-2xl px-4 py-3 active:scale-[.98] transition flex items-center justify-center gap-2 font-medium text-sm"
        >
          <Icon.WhatsApp size={16} className="text-emerald-600" />
          Chat
        </a>
        <a
          href={`tel:${customerWa.replace(/^62/, '0')}`}
          className="bg-white border border-ink-200 hover:border-ink-900 text-ink-900 rounded-2xl px-4 py-3 active:scale-[.98] transition flex items-center justify-center gap-2 font-medium text-sm"
        >
          <Icon.Phone size={16} />
          Telepon
        </a>
      </div>
    </section>
  );
}

function getStatusLabel(status) {
  const map = {
    pending: 'Menunggu Pembayaran',
    processing: 'Sedang Diproses',
    done: 'Pesanan Selesai',
    cancelled: 'Pesanan Dibatalkan',
  };
  return map[status] || 'Pesanan';
}

function getStatusBg(status) {
  const map = {
    pending: 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800',
    processing: 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900',
    done: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900',
    cancelled: 'bg-gradient-to-br from-red-600 via-red-700 to-red-900',
  };
  return map[status] || 'bg-gradient-to-br from-ink-900 via-ink-800 to-accent-700';
}

function getStatusDot(status) {
  const map = {
    pending: 'bg-amber-300 animate-pulse',
    processing: 'bg-blue-300 animate-pulse',
    done: 'bg-emerald-300',
    cancelled: 'bg-red-300',
  };
  return map[status] || 'bg-emerald-400 animate-pulse';
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending':
      return <Icon.Clock size={28} />;
    case 'processing':
      return <Icon.Bolt size={28} />;
    case 'done':
      return <Icon.Check size={28} strokeWidth={3} />;
    case 'cancelled':
      return <Icon.Close size={28} strokeWidth={3} />;
    default:
      return <Icon.Receipt size={28} />;
  }
}
