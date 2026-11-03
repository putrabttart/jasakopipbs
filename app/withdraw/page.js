'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Icon } from '@/components/Icons';
import { isValidPhone, formatPhone } from '@/lib/phone';
import { getFingerprint } from '@/lib/fingerprint';

const STORAGE_KEY = 'referral-phone';

const METHODS = [
  {
    id: 'dana',
    name: 'DANA',
    short: 'DANA',
    accent: 'text-sky-600',
    bgSel: 'bg-sky-50',
    accountLabel: 'Nomor DANA',
    placeholder: '08xxxxxxxxxx',
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay',
    short: 'Shopee',
    accent: 'text-orange-600',
    bgSel: 'bg-orange-50',
    accountLabel: 'Nomor ShopeePay',
    placeholder: '08xxxxxxxxxx',
  },
  {
    id: 'seabank',
    name: 'SeaBank',
    short: 'SeaBank',
    accent: 'text-cyan-600',
    bgSel: 'bg-cyan-50',
    accountLabel: 'Rekening SeaBank',
    placeholder: '901xxxxxxxxx',
  },
];

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

export default function WithdrawPage() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState('');
  const [user, setUser] = useState(null);
  const [pinStatus, setPinStatus] = useState(null); // { has_pin, locked }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({ min_withdraw: 10000 });

  // Form state
  const [method, setMethod] = useState('dana');
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    fetch('/api/referral/config')
      .then((r) => r.json())
      .then((j) => j.error_code === 0 && setConfig(j.data));

    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : '';
    if (saved) {
      setPhoneInput(saved);
      loadUser(saved);
    }
  }, []);

  async function loadUser(phone) {
    if (!isValidPhone(phone)) {
      setError('Nomor WhatsApp tidak valid');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/referral/me?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json.error_code === 0) {
        setUser(json.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, phone);
        }
        if (json.data.name) setAccountName(json.data.name);

        // Load PIN status
        const pinRes = await fetch(
          `/api/referral/pin?phone=${encodeURIComponent(phone)}`
        );
        const pinJson = await pinRes.json();
        if (pinJson.error_code === 0) {
          setPinStatus(pinJson.data);
        }
      } else {
        setError(json.msg || 'Gagal load data');
      }
    } catch (e) {
      setError(e.message || 'Gagal load data');
    }
    setLoading(false);
  }

  async function handleWithdraw(e) {
    e.preventDefault();
    setError('');

    const amt = Math.floor(Number(amount) || 0);
    if (amt < config.min_withdraw) {
      setError(`Minimum penarikan ${rupiah(config.min_withdraw)}`);
      return;
    }
    if (amt > user.balance) {
      setError('Saldo tidak mencukupi');
      return;
    }
    if (!accountNumber.trim() || !accountName.trim()) {
      setError('Nomor & nama akun wajib diisi');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN harus 6 digit angka');
      return;
    }

    setSubmitting(true);
    try {
      const fingerprint = getFingerprint();
      const res = await fetch('/api/referral/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fingerprint': fingerprint,
        },
        body: JSON.stringify({
          phone: user.phone,
          amount: amt,
          method,
          account_number: accountNumber.trim(),
          account_name: accountName.trim(),
          pin,
          fingerprint,
        }),
      });
      const json = await res.json();
      if (json.error_code === 0) {
        setSuccessData(json.data);
        setPin('');
        await loadUser(user.phone);
      } else {
        if (json.code === 'pin_required') {
          router.push('/referral/pin');
          return;
        }
        setError(json.msg || 'Gagal proses penarikan');
      }
    } catch (e) {
      setError(e.message || 'Gagal proses penarikan');
    }
    setSubmitting(false);
  }

  function reset() {
    setSuccessData(null);
    setAmount('');
    setAccountNumber('');
    setAccountName(user?.name || '');
  }

  // ===== Sukses =====
  if (successData) {
    const m = METHODS.find((x) => x.id === successData.method);
    return (
      <main className="pb-24">
        <Header title="Penarikan Berhasil" subtitle="Iqbal" back="/referral" showCart={false} />
        <div className="max-w-md mx-auto px-4 md:px-6 pt-3 space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 text-center relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white/20 backdrop-blur grid place-items-center mb-2">
                <Icon.Check size={22} strokeWidth={3} />
              </div>
              <p className="text-xs font-semibold opacity-90">Permintaan Diterima</p>
              <p className="text-2xl font-extrabold mt-1">{rupiah(successData.amount)}</p>
              <p className="text-[10px] opacity-80 mt-0.5">Diproses dalam 1×24 jam</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-ink-200 p-3 space-y-2">
            <Row label="Metode" value={m?.name} />
            <Row label={m?.accountLabel} value={successData.account_number} mono />
            <Row label="Atas Nama" value={successData.account_name} />
            <Row label="Saldo Tersisa" value={rupiah(successData.new_balance)} bold />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
            <Icon.Info size={14} className="text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Admin akan verifikasi & proses dalam 1×24 jam. Hubungi admin via WhatsApp kalau lebih
              lama.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={reset}
              className="bg-white border border-ink-200 hover:border-ink-900 text-ink-900 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Tarik Lagi
            </button>
            <Link
              href="/referral"
              className="bg-ink-900 hover:bg-ink-800 text-white py-2.5 rounded-xl text-sm font-semibold text-center transition"
            >
              Kembali
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ===== Belum login =====
  if (!user?.registered) {
    return (
      <main className="pb-24">
        <Header title="Tarik Saldo" subtitle="Iqbal" back="/" showCart={false} />
        <div className="max-w-md mx-auto px-4 md:px-6 pt-3 space-y-3">
          <div className="rounded-2xl bg-gradient-to-r from-ink-900 to-accent-700 text-white p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
              <Icon.Phone size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-tight">Cek Saldo Referral</p>
              <p className="text-[10px] opacity-80 mt-0.5">Masukkan nomor WA terdaftar</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadUser(phoneInput);
            }}
            className="rounded-2xl bg-white border border-ink-200 p-4 space-y-2.5"
          >
            <div>
              <label className="text-xs font-bold text-ink-900">Nomor WhatsApp</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="08123456789"
                inputMode="tel"
                className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink-900 focus:bg-white transition"
                required
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
                <Icon.AlertTriangle size={12} />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !phoneInput.trim()}
              className="w-full bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300 text-white py-3 rounded-xl font-bold text-sm active:scale-[.98] transition flex items-center justify-center gap-2"
            >
              {loading ? <Icon.Spinner size={14} /> : <Icon.ArrowRight size={14} />}
              Cek Saldo
            </button>

            <p className="text-[10px] text-ink-500 text-center">
              Belum punya?{' '}
              <Link href="/referral" className="text-ink-900 font-bold underline">
                Daftar di sini
              </Link>
            </p>
          </form>
        </div>
      </main>
    );
  }

  // ===== Form withdraw =====
  const selectedMethod = METHODS.find((m) => m.id === method);
  const amt = Number(amount) || 0;
  const canSubmit =
    amt >= config.min_withdraw &&
    amt <= user.balance &&
    accountNumber.trim() &&
    accountName.trim() &&
    /^\d{6}$/.test(pin);

  const hasPending = user.withdrawals?.some((w) =>
    ['pending', 'processing'].includes(w.status)
  );

  return (
    <main className="pb-24">
      <Header title="Tarik Saldo" subtitle="Iqbal" back="/referral" showCart={false} />

      <div className="max-w-md mx-auto px-4 md:px-6 pt-3 space-y-3">
        {/* Saldo — compact */}
        <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-accent-700 text-white p-3.5 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Saldo Tersedia
              </p>
              <p className="text-2xl font-extrabold mt-0.5 tracking-tight leading-none">
                {rupiah(user.balance)}
              </p>
              <p className="text-[10px] opacity-75 mt-1 truncate">
                {formatPhone(user.phone)}
                {user.name ? ` • ${user.name}` : ''}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
              <Icon.Tag size={18} />
            </div>
          </div>
        </div>

        {/* Pending alert */}
        {hasPending && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
            <Icon.Clock size={14} className="text-amber-700 shrink-0" />
            <p className="text-[11px] text-amber-800 font-medium leading-tight">
              Ada penarikan sedang diproses. Tunggu selesai sebelum tarik lagi.
            </p>
          </div>
        )}

        {user.balance < config.min_withdraw ? (
          <div className="rounded-2xl bg-white border border-ink-200 p-5 text-center">
            <div className="w-11 h-11 mx-auto rounded-xl bg-ink-100 grid place-items-center text-ink-400 mb-2">
              <Icon.Info size={18} />
            </div>
            <p className="text-sm font-bold text-ink-900">Saldo Belum Cukup</p>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Min penarikan {rupiah(config.min_withdraw)}
            </p>
            <Link
              href="/referral"
              className="inline-flex mt-3 bg-ink-900 hover:bg-ink-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Bagikan Kode Referral
            </Link>
          </div>
        ) : pinStatus && !pinStatus.has_pin ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center">
            <div className="w-11 h-11 mx-auto rounded-xl bg-amber-100 grid place-items-center text-amber-700 mb-2">
              <Icon.Lock size={18} />
            </div>
            <p className="text-sm font-bold text-amber-900">Buat PIN Dulu</p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Untuk keamanan, semua penarikan butuh PIN 6 digit. Buat PIN sekarang.
            </p>
            <Link
              href="/referral/pin"
              className="inline-flex mt-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Buat PIN Sekarang
            </Link>
          </div>
        ) : pinStatus?.locked ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
            <div className="w-11 h-11 mx-auto rounded-xl bg-red-100 grid place-items-center text-red-700 mb-2">
              <Icon.Lock size={18} />
            </div>
            <p className="text-sm font-bold text-red-900">PIN Terkunci</p>
            <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
              Terlalu banyak salah PIN. Coba lagi 1 jam dari sekarang.
            </p>
          </div>
        ) : (
          <form onSubmit={handleWithdraw} className="space-y-3">
            {/* Method — 3-column grid kompak */}
            <div className="rounded-2xl bg-white border border-ink-200 p-3">
              <p className="text-[11px] font-bold text-ink-900 mb-2">Metode Pencairan</p>
              <div className="grid grid-cols-3 gap-1.5">
                {METHODS.map((m) => {
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={
                        'relative rounded-xl border px-2 py-2.5 transition text-center ' +
                        (active
                          ? 'border-ink-900 bg-ink-900 text-white shadow-soft'
                          : 'border-ink-200 ' + m.bgSel + ' ' + m.accent + ' hover:border-ink-400')
                      }
                    >
                      {active && (
                        <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-white text-ink-900 grid place-items-center">
                          <Icon.Check size={9} strokeWidth={3} />
                        </span>
                      )}
                      <p className="text-[11px] font-bold leading-tight">{m.short}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount + Account fields — satu card */}
            <div className="rounded-2xl bg-white border border-ink-200 p-3 space-y-3">
              {/* Amount */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold text-ink-900">Nominal</label>
                  <span className="text-[10px] text-ink-500">
                    Min {rupiah(config.min_withdraw)}
                  </span>
                </div>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10000"
                    inputMode="numeric"
                    max={user.balance}
                    min={config.min_withdraw}
                    className="w-full bg-ink-50 border border-ink-200 rounded-xl pl-9 pr-3 py-2.5 text-base font-bold outline-none focus:border-ink-900 focus:bg-white transition"
                  />
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {[config.min_withdraw, 25000, 50000, user.balance]
                    .filter((v) => v <= user.balance && v >= config.min_withdraw)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        className="text-[10px] font-semibold bg-ink-100 hover:bg-ink-200 text-ink-700 px-2 py-1 rounded-md transition"
                      >
                        {v === user.balance ? 'Semua' : rupiah(v)}
                      </button>
                    ))}
                </div>
              </div>

              {/* Account number */}
              <div>
                <label className="text-[11px] font-bold text-ink-900">
                  {selectedMethod.accountLabel}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={selectedMethod.placeholder}
                  inputMode="numeric"
                  className="w-full mt-1 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink-900 focus:bg-white transition"
                  required
                />
              </div>

              {/* Account name */}
              <div>
                <label className="text-[11px] font-bold text-ink-900">Atas Nama</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Nama sesuai akun"
                  className="w-full mt-1 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-ink-900 focus:bg-white transition"
                  required
                />
              </div>

              {/* PIN */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold text-ink-900">PIN 6 Digit</label>
                  <Link
                    href="/referral/pin"
                    className="text-[10px] text-ink-500 hover:text-ink-900 font-semibold"
                  >
                    Lupa PIN?
                  </Link>
                </div>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="······"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full mt-1 bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-center text-lg tracking-[0.3em] font-bold outline-none focus:border-ink-900 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-[11px] text-red-700 font-semibold flex items-center gap-2">
                <Icon.AlertTriangle size={12} />
                {error}
              </div>
            )}

            {/* Summary mini */}
            {amt > 0 && (
              <div className="rounded-xl bg-ink-50 border border-ink-200 p-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-500">Tarik</span>
                  <span className="font-bold text-ink-900">{rupiah(amt)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-500">Saldo setelahnya</span>
                  <span className="font-bold text-ink-900">{rupiah(user.balance - amt)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300 text-white py-3 rounded-xl font-bold text-sm active:scale-[.98] transition flex items-center justify-center gap-2 shadow-lg shadow-ink-900/20"
            >
              {submitting ? <Icon.Spinner size={14} /> : <Icon.ArrowRight size={14} />}
              Tarik {amt > 0 ? rupiah(amt) : 'Saldo'}
            </button>

            <p className="text-[10px] text-ink-500 text-center leading-relaxed">
              Diproses manual oleh admin dalam 1×24 jam. Pastikan nomor & nama akun benar.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function Row({ label, value, bold, mono }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-500">{label}</span>
      <span
        className={
          (bold ? 'font-bold text-sm text-ink-900' : 'text-ink-900 font-semibold') +
          (mono ? ' font-mono' : '')
        }
      >
        {value}
      </span>
    </div>
  );
}
