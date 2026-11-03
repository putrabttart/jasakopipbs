'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useCart, rupiah } from '@/components/CartContext';
import { encodeOrder, generateOrderId } from '@/components/orderEncode';
import { Icon } from '@/components/Icons';
import { useServiceStatus } from '@/components/ServiceStatus';
import { useStock } from '@/components/StockGuard';
import { saveOrderToHistory } from '@/app/orders/page';
import MapPicker from '@/components/MapPicker';
import { normalizePhone, isValidPhone } from '@/lib/phone';

function pad(n) {
  return n.toString().padStart(2, '0');
}
function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + minutes, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isTimeWithin(time, open, close) {
  if (!open || !close) return true;
  const [oH, oM] = open.split(':').map(Number);
  const [cH, cM] = close.split(':').map(Number);
  const [tH, tM] = time.split(':').map(Number);
  const t = tH * 60 + tM;
  const o = oH * 60 + oM;
  const c = cH * 60 + cM;
  return t >= o && t <= c;
}

export default function CheckoutPage() {
  const {
    items,
    store,
    subtotal,
    origSubtotal,
    discount,
    discountCapped,
    serviceFee,
    total,
    clear,
    hydrated,
    pickup,
    setPickup,
    orderType,
    setOrderType,
    deliveryAddress,
    setDeliveryAddress,
    deliveryLocation,
    setDeliveryLocation,
    deliveryAvailable,
    deliveryFee,
  } = useCart();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const serviceStatus = useServiceStatus();
  const stock = useStock();

  // Referral state
  const [referralCode, setReferralCode] = useState('');
  const [referralData, setReferralData] = useState(null); // { code, referrer_name, reward }
  const [referralError, setReferralError] = useState('');
  const [referralChecking, setReferralChecking] = useState(false);

  // Saldo state
  const [userBalance, setUserBalance] = useState(0);
  const [useBalance, setUseBalance] = useState(false);
  const [balanceChecked, setBalanceChecked] = useState(false);
  const [ownReferralCode, setOwnReferralCode] = useState(''); // kode milik user sendiri (untuk dideteksi)

  useEffect(() => {
    if (pickup.type === 'later' && !pickup.time) {
      setPickup({ type: 'later', time: addMinutes(nowHHMM(), 30) });
    }
  }, [pickup.type]); // eslint-disable-line

  // Auto-fill referral code dari URL atau localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('ref');
    if (fromUrl) {
      setReferralCode(fromUrl.toUpperCase());
      try {
        localStorage.setItem('ref-code', fromUrl.toUpperCase());
      } catch (_) {}
      return;
    }
    try {
      const saved = localStorage.getItem('ref-code');
      if (saved) setReferralCode(saved);
    } catch (_) {}
  }, []);

  // Auto-fill nama & nomor dari localStorage referral
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem('referral-phone');
      if (savedPhone && !phone) {
        // Convert 62xxx → 08xxx untuk display
        const display = savedPhone.startsWith('62') ? '0' + savedPhone.slice(2) : savedPhone;
        setPhone(display);
      }
    } catch (_) {}
  }, []); // eslint-disable-line

  // Cek saldo + kode milik sendiri saat phone input berubah
  useEffect(() => {
    if (!isValidPhone(phone)) {
      setUserBalance(0);
      setBalanceChecked(false);
      setUseBalance(false);
      setOwnReferralCode('');
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/referral/me?phone=${encodeURIComponent(normalizePhone(phone))}`
        );
        const json = await res.json();
        if (json.error_code === 0) {
          setUserBalance(json.data?.balance || 0);
          setBalanceChecked(true);
          setOwnReferralCode((json.data?.referral_code || '').toUpperCase());
        }
      } catch (_) {}
    }, 500);
    return () => clearTimeout(t);
  }, [phone]);

  // Auto-clear kode referral kalau itu adalah kode milik user sendiri
  useEffect(() => {
    if (!ownReferralCode || !referralCode) return;
    if (referralCode.toUpperCase() === ownReferralCode) {
      setReferralCode('');
      setReferralData(null);
      setReferralError('');
      try {
        localStorage.removeItem('ref-code');
      } catch (_) {}
    }
  }, [ownReferralCode, referralCode]);

  // Validate referral code (debounced) — re-trigger setiap kode atau phone berubah
  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralData(null);
      setReferralError('');
      return;
    }
    // Reset state ke checking dulu agar UI tidak tampak "valid" pakai data stale
    setReferralData(null);
    const t = setTimeout(async () => {
      setReferralChecking(true);
      setReferralError('');
      try {
        const res = await fetch(
          `/api/referral/validate?code=${encodeURIComponent(referralCode)}&phone=${encodeURIComponent(phone)}`
        );
        const json = await res.json();
        if (json.error_code === 0) {
          setReferralData(json.data);
          setReferralError('');
        } else {
          setReferralData(null);
          setReferralError(json.msg || 'Kode tidak valid');
        }
      } catch (_) {
        setReferralData(null);
        setReferralError('Gagal validasi');
      }
      setReferralChecking(false);
    }, 400);
    return () => clearTimeout(t);
  }, [referralCode, phone]);

  const minPickupTime = addMinutes(nowHHMM(), 15);

  // Compute balance to use & final total
  const balanceUsed = useMemo(() => {
    if (!useBalance || userBalance <= 0) return 0;
    return Math.min(userBalance, total);
  }, [useBalance, userBalance, total]);

  const finalTotal = total - balanceUsed;

  const errors = {
    name: !name.trim() ? 'Nama tidak boleh kosong' : '',
    phone:
      !phone.trim()
        ? 'Nomor WA tidak boleh kosong'
        : !/^[0-9+\s-]{8,16}$/.test(phone.trim())
        ? 'Format nomor WA tidak valid'
        : '',
    pickup:
      orderType === 'pickup' && pickup.type === 'later' && !pickup.time
        ? 'Pilih waktu ambil'
        : orderType === 'pickup' &&
          pickup.type === 'later' &&
          store?.open &&
          store?.close &&
          !isTimeWithin(pickup.time, store.open.slice(0, 5), store.close.slice(0, 5))
        ? `Waktu di luar jam operasional outlet (${store.open.slice(0, 5)} - ${store.close.slice(0, 5)})`
        : '',
    address:
      orderType === 'delivery' && !deliveryAddress.trim()
        ? 'Alamat pengiriman wajib diisi'
        : '',
  };
  const hasError = Object.values(errors).some(Boolean);

  const pickupLabel =
    pickup.type === 'now'
      ? 'Ambil Sekarang (secepatnya)'
      : `Ambil Nanti pukul ${pickup.time || '-'}`;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (hasError || items.length === 0 || submitting) return;

    if (!serviceStatus.open) {
      alert('Maaf, layanan sedang tutup. ' + (serviceStatus.message || 'Silakan coba lagi nanti.'));
      return;
    }

    if (!stock.available) {
      stock.showUnavailable();
      return;
    }

    // Block submit kalau kode referral belum tervalidasi atau bermasalah
    if (referralCode.trim()) {
      if (referralChecking) {
        alert('Tunggu sebentar, kode referral sedang diverifikasi...');
        return;
      }
      if (referralError) {
        alert(referralError);
        return;
      }
      if (!referralData) {
        alert('Kode referral tidak valid. Hapus kode atau perbaiki dulu.');
        return;
      }
      // Final check self-referral di client (defense-in-depth)
      const normalizedPhone = normalizePhone(phone);
      const normalizedReferrer = normalizePhone(referralData.referrer_phone || '');
      if (normalizedPhone && normalizedReferrer && normalizedPhone === normalizedReferrer) {
        alert('Tidak bisa pakai kode referral milikmu sendiri.');
        setReferralData(null);
        setReferralError('Tidak bisa pakai kode referral milikmu sendiri');
        return;
      }
    }

    setSubmitting(true);

    // Generate kode unik 3 digit (100-999)
    const uniqueCode = Math.floor(Math.random() * 900) + 100;

    const orderId = generateOrderId();
    const order = {
      orderId,
      createdAt: new Date().toISOString(),
      customer: { name: name.trim(), phone: phone.trim() },
      pickup,
      orderType,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : '',
      deliveryLocation: orderType === 'delivery' ? deliveryLocation : null,
      deliveryFee: orderType === 'delivery' ? deliveryFee : 0,
      store: store
        ? {
            code: store.code,
            name: store.name,
            address: store.address,
          }
        : null,
      items: items.map((it) => ({
        name: it.name,
        product_code: it.product_code,
        variant: it.variant || '',
        price: Number(it.orig_price || it.price) || 0,
        qty: it.qty,
        image: it.image || '',
      })),
      subtotal,
      origSubtotal,
      discount,
      discountCapped,
      serviceFee,
      total,           // total tanpa kode unik
      balanceUsed,     // saldo referral yang dipotong
      referralCode: referralData?.code || '',
      uniqueCode,      // kode unik 3 digit
      totalToPay: finalTotal + uniqueCode, // total final yang harus dibayar (setelah saldo)
    };

    const token = encodeOrder(order);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    // Simpan order ke database
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const json = await res.json();
      if (json.error_code !== 0) {
        if (json.code === 'stock_unavailable') {
          stock.showUnavailable(json.msg);
        } else {
          alert(json.msg || 'Gagal menyimpan pesanan');
        }
        setSubmitting(false);
        return;
      }
    } catch (e) {
      alert('Gagal menyimpan pesanan: ' + (e.message || 'unknown'));
      setSubmitting(false);
      return;
    }

    // Simpan ke riwayat user
    saveOrderToHistory(orderId);

    // Kosongkan keranjang
    clear();

    // Arahkan ke halaman pembayaran (loading state akan tampil di payment page)
    router.push(`/payment/${orderId}`);
  }

  if (hydrated && items.length === 0) {
    return (
      <main className="pb-24">
        <Header title="Checkout" back="/cart" showCart={false} />
        <div className="max-w-md mx-auto px-4 mt-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-ink-100 grid place-items-center mb-4 text-ink-400">
            <Icon.Bag size={36} />
          </div>
          <p className="font-semibold text-lg text-ink-900">Belum ada pesanan</p>
          <p className="text-sm text-ink-500 mt-1">Yuk pilih menu favoritmu dulu.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-5 bg-ink-900 text-white text-sm font-semibold px-6 py-3 rounded-2xl hover:bg-ink-800 active:scale-95 transition"
          >
            Cari Outlet →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-32">
      <Header title="Checkout" subtitle="Konfirmasi Pesanan" back="/cart" showCart={false} />

      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <form
          onSubmit={handleSubmit}
          className="mt-4 md:mt-6 md:grid md:grid-cols-[1fr_360px] md:gap-6"
        >
          <div className="space-y-3 md:space-y-4">
            <section className="rounded-2xl bg-white border border-ink-200 p-4 md:p-6 space-y-4">
              <div>
                <h2 className="text-sm md:text-base font-semibold text-ink-900">Data Pelanggan</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  Data ini dikirim ke admin untuk konfirmasi pesanan.
                </p>
              </div>

              <Field label="Nama Pelanggan" error={touched && errors.name} required>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="cth: Andi Pratama"
                  className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-900 focus:bg-white transition"
                />
              </Field>

              <Field
                label="Nomor WhatsApp"
                error={touched && errors.phone}
                required
                hint="Pastikan nomor aktif untuk konfirmasi pesanan"
              >
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="cth: 08123456789"
                  inputMode="tel"
                  className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-900 focus:bg-white transition"
                />
              </Field>
            </section>

            <section className="rounded-2xl bg-white border border-ink-200 p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">Tipe Pesanan</h2>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Pilih cara mendapatkan pesananmu.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <PickupOption
                  active={orderType === 'pickup'}
                  onClick={() => setOrderType('pickup')}
                  icon={<Icon.Bag size={16} />}
                  title="Pickup"
                  desc="Ambil di outlet"
                />
                <PickupOption
                  active={orderType === 'delivery'}
                  onClick={() => deliveryAvailable && setOrderType('delivery')}
                  icon={<Icon.Pin size={16} />}
                  title="Delivery"
                  desc={deliveryAvailable ? `+${rupiah(deliveryFee || 0)}` : 'Tidak tersedia'}
                  disabled={!deliveryAvailable}
                />
              </div>

              {orderType === 'delivery' && deliveryAvailable && (
                <div className="fade-up space-y-3">
                  <Field label="Lokasi Pengiriman" required>
                    <MapPicker
                      value={
                        deliveryLocation
                          ? { ...deliveryLocation, address: deliveryAddress }
                          : null
                      }
                      onChange={({ lat, lng, address }) => {
                        setDeliveryLocation({ lat, lng });
                        if (address) setDeliveryAddress(address);
                      }}
                      storeLat={store?.latitude}
                      storeLng={store?.longitude}
                    />
                  </Field>

                  <Field label="Detail Alamat" error={touched && errors.address} required>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      onBlur={() => setTouched(true)}
                      placeholder="No. rumah, RT/RW, patokan, dll"
                      rows={3}
                      className="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-ink-900 focus:bg-white transition resize-none"
                    />
                  </Field>
                </div>
              )}

              {orderType === 'delivery' && !deliveryAvailable && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                  <Icon.Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Outlet ini tidak melayani delivery. Silakan pilih pickup.
                  </p>
                </div>
              )}
            </section>

            {orderType === 'pickup' && (
            <section className="rounded-2xl bg-white border border-ink-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink-900">Waktu Ambil</h2>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Pilih kapan mau ambil pesanan.
                  </p>
                </div>
                {store?.open && store?.close && (
                  <span className="shrink-0 text-[10px] bg-ink-100 text-ink-700 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                    <Icon.Clock size={10} />
                    {store.open.slice(0, 5)} - {store.close.slice(0, 5)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <PickupOption
                  active={pickup.type === 'now'}
                  onClick={() => setPickup({ type: 'now', time: '' })}
                  icon={<Icon.Bolt size={16} />}
                  title="Ambil Sekarang"
                  desc="Secepatnya"
                />
                <PickupOption
                  active={pickup.type === 'later'}
                  onClick={() =>
                    setPickup({
                      type: 'later',
                      time: pickup.time || addMinutes(nowHHMM(), 30),
                    })
                  }
                  icon={<Icon.Clock size={16} />}
                  title="Ambil Nanti"
                  desc="Atur waktu sendiri"
                />
              </div>

              {pickup.type === 'later' && (
                <div className="fade-up">
                  <Field label="Jam Ambil" error={touched && errors.pickup} required>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={pickup.time}
                        min={minPickupTime}
                        onChange={(e) =>
                          setPickup({ type: 'later', time: e.target.value })
                        }
                        onBlur={() => setTouched(true)}
                        className="flex-1 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-ink-900 focus:bg-white transition"
                      />
                      <div className="flex gap-1">
                        {[15, 30, 60].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              setPickup({ type: 'later', time: addMinutes(nowHHMM(), m) })
                            }
                            className="text-xs bg-white border border-ink-200 hover:border-ink-900 text-ink-700 px-2 py-1.5 rounded-lg transition"
                          >
                            +{m}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <p className="text-[10px] text-ink-500 mt-1">
                    Minimal {minPickupTime} (15 menit dari sekarang).
                  </p>
                </div>
              )}
            </section>
            )}

            <section className="rounded-2xl bg-white border border-ink-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center text-emerald-600">
                  <Icon.Gift size={16} />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-ink-900">Kode Referral & Saldo</h2>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Pakai kode teman atau saldo referral kamu
                  </p>
                </div>
              </div>

              {/* Saldo */}
              {balanceChecked && userBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setUseBalance(!useBalance)}
                  className={
                    'w-full rounded-xl border p-3 flex items-center gap-3 transition active:scale-[.99] text-left ' +
                    (useBalance
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-ink-200 bg-white hover:border-ink-400')
                  }
                >
                  <div
                    className={
                      'w-9 h-9 rounded-lg grid place-items-center shrink-0 ' +
                      (useBalance ? 'bg-white/15' : 'bg-emerald-50 text-emerald-600')
                    }
                  >
                    <Icon.Tag size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">
                      {useBalance ? 'Saldo dipakai' : 'Pakai saldo referral'}
                    </p>
                    <p
                      className={
                        'text-[10px] mt-0.5 ' + (useBalance ? 'opacity-80' : 'text-ink-500')
                      }
                    >
                      Saldo tersedia: {rupiah(userBalance)}
                    </p>
                  </div>
                  <div
                    className={
                      'w-5 h-5 rounded-md border-2 grid place-items-center shrink-0 ' +
                      (useBalance ? 'bg-white border-white text-ink-900' : 'border-ink-300')
                    }
                  >
                    {useBalance && <Icon.Check size={12} strokeWidth={3} />}
                  </div>
                </button>
              )}

              {/* Kode referral */}
              <div>
                <label className="text-[11px] font-bold text-ink-700">
                  Kode Referral (opsional)
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="cth: KKA8X2K9"
                    className={
                      'w-full bg-ink-50 border rounded-xl pl-3 pr-10 py-2.5 text-sm font-bold tracking-wider outline-none focus:bg-white transition ' +
                      (referralData
                        ? 'border-emerald-500 text-emerald-700'
                        : referralError
                        ? 'border-red-300'
                        : 'border-ink-200 focus:border-ink-900')
                    }
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {referralChecking ? (
                      <Icon.Spinner size={14} className="text-ink-400" />
                    ) : referralData ? (
                      <Icon.Check size={16} className="text-emerald-600" strokeWidth={3} />
                    ) : referralError ? (
                      <Icon.Close size={14} className="text-red-500" />
                    ) : null}
                  </div>
                </div>
                {referralData && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                    <Icon.Check size={12} strokeWidth={3} />
                    Kode dari {referralData.referrer_name}
                  </p>
                )}
                {referralError && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1.5">
                    {referralError}
                  </p>
                )}
              </div>

              <p className="text-[10px] text-ink-500 leading-relaxed">
                Belum punya kode? <a href="/referral" target="_blank" rel="noreferrer" className="text-ink-900 font-bold underline">Daftar di sini</a> untuk dapat kodemu sendiri.
              </p>
            </section>

            <section className="rounded-2xl bg-ink-900 text-white p-4 md:p-5 flex gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 grid place-items-center shrink-0 text-white">
                <Icon.Info size={18} />
              </div>
              <div className="text-xs md:text-sm">
                <p className="font-semibold">Langkah selanjutnya</p>
                <p className="opacity-80 mt-0.5 leading-relaxed">
                  Setelah klik <span className="font-semibold text-white">Lanjut ke Pembayaran</span>,
                  kamu akan diarahkan ke halaman pembayaran. Bayar lalu upload bukti transfer.
                </p>
              </div>
            </section>
          </div>

          <aside className="mt-3 md:mt-0">
            <div className="md:sticky md:top-20 space-y-3">
              <section className="rounded-2xl bg-white border border-ink-200 p-4 md:p-5">
                <h2 className="text-sm font-semibold text-ink-900 mb-3">Ringkasan Pesanan</h2>

                {store && (
                  <div className="text-xs mb-3 pb-3 border-b border-ink-200">
                    <p className="font-semibold text-ink-900">{store.name}</p>
                    <p className="text-ink-500 line-clamp-2 mt-0.5">{store.address}</p>
                  </div>
                )}

                <div className="text-xs mb-3 pb-3 border-b border-ink-200">
                  <p className="text-ink-500">Waktu Ambil</p>
                  <p className="font-semibold text-ink-900 mt-0.5">{pickupLabel}</p>
                </div>

                <ul className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2.5 text-xs">
                      <div className="w-12 h-12 rounded-lg bg-ink-100 overflow-hidden shrink-0">
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-ink-400">
                            <Icon.Coffee size={18} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-ink-900 text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full grid place-items-center shrink-0">
                            {it.qty}×
                          </span>
                          <p className="font-medium text-ink-900 truncate">{it.name}</p>
                        </div>
                        {it.variant && (
                          <p className="text-[10px] text-ink-500 truncate mt-0.5">{it.variant}</p>
                        )}
                      </div>
                      <span className="font-semibold whitespace-nowrap shrink-0 text-ink-900">
                        {rupiah(Number(it.orig_price || it.price) * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-ink-200 mt-3 pt-3 space-y-1.5 text-xs">
                  {origSubtotal > subtotal && (
                    <Row
                      label="Subtotal harga normal"
                      value={rupiah(origSubtotal)}
                      valueClass="text-ink-400 line-through"
                    />
                  )}
                  {discount > 0 && (
                    <Row
                      label={discountCapped ? `Hemat 50% (maks ${rupiah(35000)})` : 'Hemat 50%'}
                      value={`- ${rupiah(discount)}`}
                      valueClass="text-emerald-600 font-semibold"
                    />
                  )}
                  <Row label="Subtotal setelah diskon" value={rupiah(subtotal)} />
                  <Row label="Biaya jasa order" value={rupiah(serviceFee)} />
                  {orderType === 'delivery' && deliveryFee > 0 && (
                    <Row label="Biaya delivery" value={rupiah(deliveryFee)} />
                  )}
                  {balanceUsed > 0 && (
                    <Row
                      label="Saldo referral dipakai"
                      value={`- ${rupiah(balanceUsed)}`}
                      valueClass="text-emerald-600 font-semibold"
                    />
                  )}
                </div>
                <div className="border-t border-ink-200 mt-2 pt-2 flex justify-between items-baseline">
                  <span className="font-semibold text-ink-900">Total Bayar</span>
                  <span className="font-bold text-xl text-ink-900">{rupiah(finalTotal)}</span>
                </div>

                <div className="hidden md:flex flex-col gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300 text-white rounded-2xl px-4 py-3.5 active:scale-95 transition flex items-center justify-center gap-2 font-semibold text-sm"
                  >
                    {submitting ? <Icon.Spinner size={14} /> : <Icon.ArrowRight size={16} />}
                    Lanjut ke Pembayaran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Yakin batalkan pesanan dan kosongkan keranjang?')) {
                        clear();
                        router.push('/');
                      }
                    }}
                    className="w-full bg-white border border-ink-200 hover:border-ink-900 text-ink-700 hover:text-ink-900 text-sm font-medium px-4 py-3 rounded-2xl transition"
                  >
                    Batalkan Pesanan
                  </button>
                </div>
              </section>
            </div>
          </aside>

          {/* Mobile submit */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-ink-200" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="max-w-md mx-auto px-4 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Yakin batalkan pesanan dan kosongkan keranjang?')) {
                    clear();
                    router.push('/');
                  }
                }}
                className="bg-white border border-ink-200 text-ink-700 text-sm font-medium px-4 py-3.5 rounded-2xl hover:border-ink-900 active:scale-95 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300 text-white rounded-2xl px-4 py-3.5 active:scale-[.98] flex items-center justify-center gap-2 font-semibold text-sm transition shadow-lg shadow-ink-900/20"
              >
                {submitting ? <Icon.Spinner size={14} /> : <Icon.ArrowRight size={16} />}
                Lanjut Bayar
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function PickupOption({ active, onClick, icon, title, desc, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'text-left rounded-xl border p-3 transition active:scale-[.98] ' +
        (disabled
          ? 'border-ink-200 bg-ink-50 opacity-50 cursor-not-allowed'
          : active
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-ink-200 bg-white hover:border-ink-400')
      }
    >
      <div className="flex items-center gap-2">
        <div
          className={
            'w-7 h-7 rounded-lg grid place-items-center shrink-0 ' +
            (active && !disabled ? 'bg-white/15' : 'bg-ink-100 text-ink-700')
          }
        >
          {icon}
        </div>
        <p className={'text-xs font-bold leading-tight ' + (active && !disabled ? 'text-white' : 'text-ink-900')}>
          {title}
        </p>
      </div>
      <p className={'text-[10px] mt-1.5 leading-tight ' + (active && !disabled ? 'text-white/70' : 'text-ink-500')}>
        {desc}
      </p>
    </button>
  );
}

function WhatsAppIcon() {
  return null;
}

function Field({ label, children, error, required, hint }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-900 flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-[10px] text-ink-500 mt-0.5">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className={valueClass || 'text-ink-900 font-medium'}>{value}</span>
    </div>
  );
}
