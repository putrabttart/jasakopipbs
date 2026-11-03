'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Icon } from '@/components/Icons';
import { isValidPhone, formatPhone } from '@/lib/phone';
import { getFingerprint } from '@/lib/fingerprint';

const STORAGE_KEY = 'referral-phone';

const WITHDRAW_STATUS = {
  pending: {
    label: 'Pending',
    iconBg: 'bg-amber-50 text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  processing: {
    label: 'Diproses',
    iconBg: 'bg-blue-50 text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  completed: {
    label: 'Sukses',
    iconBg: 'bg-emerald-50 text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  rejected: {
    label: 'Ditolak',
    iconBg: 'bg-red-50 text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
};

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

export default function ReferralPage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({ reward: 2000, min_withdraw: 10000 });
  const [copied, setCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  useEffect(() => {
    fetch('/api/referral/config')
      .then((r) => r.json())
      .then((j) => {
        if (j.error_code === 0) setConfig(j.data);
      });

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
      } else {
        setError(json.msg || 'Gagal load data');
      }
    } catch (e) {
      setError(e.message || 'Gagal load data');
    }
    setLoading(false);
  }

  async function handleRegister(e) {
    e?.preventDefault();
    if (!isValidPhone(phoneInput)) {
      setError('Nomor WhatsApp tidak valid');
      return;
    }
    if (!nameInput.trim()) {
      setError('Nama wajib diisi (kode referral dari nama depanmu)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fingerprint = getFingerprint();
      const res = await fetch('/api/referral/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fingerprint': fingerprint,
        },
        body: JSON.stringify({
          phone: phoneInput,
          name: nameInput,
          fingerprint,
        }),
      });
      const json = await res.json();
      if (json.error_code === 0) {
        await loadUser(phoneInput);
      } else {
        setError(json.msg || 'Gagal daftar');
      }
    } catch (e) {
      setError(e.message || 'Gagal daftar');
    }
    setLoading(false);
  }

  function handleLogout() {
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setPhoneInput('');
    setNameInput('');
  }

  function handleShare(via) {
    const code = user.referral_code;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/?ref=${code}`;
    const msg = [
      `Halo! Aku rekomendasiin layanan Jasa Order Kopi Kenangan.`,
      ``,
      `Pakai kode referral aku: *${code}*`,
      `${link}`,
      ``,
      `Diskon 50% otomatis tiap order, plus aku dapet bonus saldo Rp ${config.reward.toLocaleString('id-ID')} kalau kamu order pakai kode ini 🙌`,
    ].join('\n');

    if (via === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (via === 'copy') {
      navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else if (via === 'native' && navigator.share) {
      navigator.share({ text: msg, title: 'Kode Referral' }).catch(() => {});
    }
    setShowShareSheet(false);
  }

  function copyCode() {
    if (!user) return;
    navigator.clipboard.writeText(user.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // === Tampilan setelah login ===
  if (user?.registered) {
    return (
      <main className="pb-24">
        <Header title="Program Referral" subtitle="Iqbal" back="/" showCart={false} />

        <div className="max-w-md mx-auto px-4 md:px-6 pt-3 space-y-4">
          {/* Hero saldo */}
          <div className="rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-accent-700 text-white overflow-hidden relative">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-accent-500/20 blur-3xl" />

            <div className="relative p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                    Saldo Referral
                  </p>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight">
                    {rupiah(user.balance)}
                  </p>
                  <p className="text-[10px] opacity-80 mt-1">
                    Total earned: {rupiah(user.total_earned)}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[10px] bg-white/15 hover:bg-white/25 backdrop-blur px-2.5 py-1 rounded-full transition"
                  title="Ganti nomor"
                >
                  Ganti
                </button>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[10px] opacity-80">
                <Icon.Phone size={11} />
                <span>{formatPhone(user.phone)}</span>
                {user.name && <span className="opacity-60">• {user.name}</span>}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <Link
                  href="/withdraw"
                  className="bg-white/15 hover:bg-white/25 backdrop-blur transition rounded-xl py-2.5 px-3 text-center text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Icon.ArrowRight size={12} />
                  Tarik Saldo
                </Link>
                <button
                  onClick={() => setShowShareSheet(true)}
                  className="bg-white text-ink-900 rounded-xl py-2.5 px-3 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-ink-50 transition"
                >
                  <Icon.Gift size={12} />
                  Bagikan Kode
                </button>
              </div>

              <Link
                href="/referral/pin"
                className="mt-2 w-full bg-white/10 hover:bg-white/20 backdrop-blur transition rounded-xl py-2 px-3 text-center text-[11px] font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Icon.Lock size={12} />
                Atur PIN Keamanan
              </Link>
            </div>
          </div>

          {/* Kode referral */}
          <div className="rounded-2xl bg-white border border-ink-200 p-5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-bold">
              Kode Referral Kamu
            </p>
            <button
              onClick={copyCode}
              className="mt-2 inline-flex items-center gap-2 group"
              title="Tap untuk salin"
            >
              <span className="text-3xl font-extrabold tracking-[0.18em] text-ink-900">
                {user.referral_code}
              </span>
              <span className="text-ink-400 group-hover:text-ink-900 transition">
                <Icon.Copy size={18} />
              </span>
            </button>
            {copied && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 fade-up">
                ✓ Tersalin
              </p>
            )}
            <p className="text-[11px] text-ink-500 mt-2.5">
              Bagikan ke teman. Begitu temanmu order pakai kode ini & pesanan selesai, kamu dapat{' '}
              <span className="font-bold text-emerald-600">{rupiah(config.reward)}</span>
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Berhasil"
              value={user.stats?.total_referrals || 0}
              suffix="orang"
              color="emerald"
              Ico={Icon.Check}
            />
            <StatCard
              label="Pending"
              value={user.stats?.pending_referrals || 0}
              suffix="order"
              color="amber"
              Ico={Icon.Clock}
            />
          </div>

          {/* Cara kerja */}
          <div className="rounded-2xl bg-white border border-ink-200 p-4">
            <p className="text-xs font-bold text-ink-900 mb-3 flex items-center gap-1.5">
              <Icon.Info size={14} className="text-ink-500" />
              Cara Kerja
            </p>
            <div className="space-y-2.5">
              <Step num="1" text="Bagikan kode referral kamu ke teman" />
              <Step num="2" text="Teman order pakai kode kamu di halaman checkout" />
              <Step num="3" text={`Pesanan teman selesai → kamu dapat ${rupiah(config.reward)}`} />
              <Step
                num="4"
                text="Saldo bisa dipotong saat order, atau tarik ke e-wallet"
              />
            </div>
          </div>

          {/* History referral */}
          {user.history?.length > 0 && (
            <div className="rounded-2xl bg-white border border-ink-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-100">
                <p className="text-xs font-bold text-ink-900">Riwayat Referral</p>
              </div>
              <div className="divide-y divide-ink-100">
                {user.history.map((h) => (
                  <div key={h.id} className="p-3 flex items-center gap-3">
                    <div
                      className={
                        'w-9 h-9 rounded-xl grid place-items-center shrink-0 ' +
                        (h.status === 'credited'
                          ? 'bg-emerald-50 text-emerald-600'
                          : h.status === 'cancelled'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-600')
                      }
                    >
                      {h.status === 'credited' ? (
                        <Icon.Check size={16} />
                      ) : h.status === 'cancelled' ? (
                        <Icon.Close size={16} />
                      ) : (
                        <Icon.Clock size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink-900 truncate">
                        {h.referee_name || 'Anonim'}
                      </p>
                      <p className="text-[10px] text-ink-500">
                        Order {h.order_id} •{' '}
                        {new Date(h.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={
                          'text-sm font-bold ' +
                          (h.status === 'credited'
                            ? 'text-emerald-600'
                            : h.status === 'cancelled'
                            ? 'text-red-500 line-through'
                            : 'text-amber-600')
                        }
                      >
                        +{rupiah(h.reward)}
                      </p>
                      <p className="text-[9px] text-ink-400 uppercase font-bold tracking-wider">
                        {h.status === 'credited'
                          ? 'Masuk'
                          : h.status === 'cancelled'
                          ? 'Batal'
                          : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Riwayat penarikan */}
          {user.withdrawals?.length > 0 && (
            <div className="rounded-2xl bg-white border border-ink-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                <p className="text-xs font-bold text-ink-900">Riwayat Penarikan</p>
                <Link
                  href="/withdraw"
                  className="text-[10px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 font-semibold"
                >
                  Tarik lagi <Icon.ChevronRight size={10} />
                </Link>
              </div>
              <div className="divide-y divide-ink-100">
                {user.withdrawals.map((w) => {
                  const status = WITHDRAW_STATUS[w.status] || WITHDRAW_STATUS.pending;
                  const methodLabel =
                    { dana: 'DANA', shopeepay: 'ShopeePay', seabank: 'SeaBank' }[w.method] ||
                    w.method;
                  return (
                    <div key={w.id} className="p-3 flex items-center gap-3">
                      <div
                        className={
                          'w-9 h-9 rounded-xl grid place-items-center shrink-0 ' + status.iconBg
                        }
                      >
                        {w.status === 'completed' ? (
                          <Icon.Check size={16} />
                        ) : w.status === 'rejected' ? (
                          <Icon.Close size={16} />
                        ) : w.status === 'processing' ? (
                          <Icon.Spinner size={16} />
                        ) : (
                          <Icon.Clock size={16} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-ink-900">{methodLabel}</p>
                          <span
                            className={
                              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ' +
                              status.badge
                            }
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-500 truncate mt-0.5">
                          {w.account_number} • {w.account_name}
                        </p>
                        <p className="text-[10px] text-ink-400 mt-0.5">
                          {new Date(w.created_at).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                          {w.processed_at && (
                            <>
                              {' '}
                              • Selesai{' '}
                              {new Date(w.processed_at).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </>
                          )}
                        </p>
                        {w.notes && w.status === 'rejected' && (
                          <p className="text-[10px] text-red-600 mt-0.5 italic">
                            {w.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={
                            'text-sm font-bold ' +
                            (w.status === 'completed'
                              ? 'text-emerald-600'
                              : w.status === 'rejected'
                              ? 'text-red-500 line-through'
                              : 'text-ink-900')
                          }
                        >
                          {rupiah(w.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Share sheet */}
        {showShareSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div
              className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
              onClick={() => setShowShareSheet(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden fade-up">
              <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
                <p className="text-sm font-bold text-ink-900">Bagikan Kode</p>
                <button
                  onClick={() => setShowShareSheet(false)}
                  className="w-8 h-8 rounded-full hover:bg-ink-100 grid place-items-center text-ink-500"
                >
                  <Icon.Close size={16} />
                </button>
              </div>
              <div className="p-5 space-y-2">
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="w-full flex items-center gap-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 px-4 py-3.5 transition active:scale-[.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center">
                    <Icon.WhatsApp size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-ink-900">Bagikan via WhatsApp</p>
                    <p className="text-[10px] text-ink-500">Buka WhatsApp untuk kirim</p>
                  </div>
                </button>

                <button
                  onClick={() => handleShare('copy')}
                  className="w-full flex items-center gap-3 rounded-xl bg-ink-50 hover:bg-ink-100 px-4 py-3.5 transition active:scale-[.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-ink-900 text-white grid place-items-center">
                    <Icon.Copy size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-ink-900">
                      {copied ? '✓ Tersalin' : 'Salin Pesan'}
                    </p>
                    <p className="text-[10px] text-ink-500">Copy ke clipboard</p>
                  </div>
                </button>

                {typeof navigator !== 'undefined' && navigator.share && (
                  <button
                    onClick={() => handleShare('native')}
                    className="w-full flex items-center gap-3 rounded-xl bg-ink-50 hover:bg-ink-100 px-4 py-3.5 transition active:scale-[.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500 text-white grid place-items-center">
                      <Icon.ExternalLink size={18} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-ink-900">Lainnya</p>
                      <p className="text-[10px] text-ink-500">Pilih app lain</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // === Form daftar / lookup ===
  return (
    <main className="pb-24">
      <Header title="Program Referral" subtitle="Iqbal" back="/" showCart={false} />

      <div className="max-w-md mx-auto px-4 md:px-6 pt-3 space-y-4">
        {/* Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-ink-900 to-accent-700 text-white p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center mb-3">
              <Icon.Gift size={22} />
            </div>
            <h2 className="text-xl font-extrabold">Ajak Teman, Dapat Saldo</h2>
            <p className="text-sm opacity-90 mt-1.5 leading-relaxed">
              Tiap teman order pakai kode kamu & pesanan selesai, kamu dapat{' '}
              <span className="font-bold">{rupiah(config.reward)}</span> saldo. Bisa dipotong
              saat order atau tarik ke e-wallet.
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleRegister}
          className="rounded-2xl bg-white border border-ink-200 p-5 space-y-3"
        >
          <div>
            <label className="text-xs font-bold text-ink-900">Nomor WhatsApp</label>
            <p className="text-[10px] text-ink-500 mt-0.5">
              Identitas kamu — tidak perlu password
            </p>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="08123456789"
              inputMode="tel"
              className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-base font-semibold outline-none focus:border-ink-900 focus:bg-white transition"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink-900">
              Nama <span className="text-red-500">*</span>
            </label>
            <p className="text-[10px] text-ink-500 mt-0.5">
              Kode referral kamu = nama depan + 2 angka (cth: ANDI47)
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="cth: Andi Pratama"
              required
              className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-900 focus:bg-white transition"
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
            className="w-full bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300 text-white py-3.5 rounded-xl font-bold text-sm active:scale-[.98] transition flex items-center justify-center gap-2"
          >
            {loading ? <Icon.Spinner size={14} /> : <Icon.ArrowRight size={14} />}
            Lihat Saldo / Daftar
          </button>

          <p className="text-[10px] text-ink-500 text-center">
            Sudah daftar? Masukkan nomor WA untuk lihat saldo & kode referral kamu.
          </p>
        </form>

        {/* How it works */}
        <div className="rounded-2xl bg-white border border-ink-200 p-4">
          <p className="text-xs font-bold text-ink-900 mb-3">Cara Kerja</p>
          <div className="space-y-2.5">
            <Step num="1" text="Daftarkan nomor WA kamu (tanpa password)" />
            <Step num="2" text="Dapat kode referral unik untuk dibagikan" />
            <Step num="3" text="Teman order pakai kode kamu di checkout" />
            <Step num="4" text="Pesanan selesai → saldo Rp 2.000 masuk otomatis" />
            <Step num="5" text="Pakai saldo untuk potong order atau tarik ke e-wallet" />
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, suffix, color, Ico }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };
  return (
    <div className={'rounded-2xl border p-4 text-center ' + (colors[color] || colors.emerald)}>
      <Ico size={16} className="mx-auto opacity-70" />
      <p className="text-2xl font-extrabold mt-1.5 leading-none">{value}</p>
      <p className="text-[10px] font-bold mt-1 uppercase tracking-wider opacity-80">
        {label} {suffix}
      </p>
    </div>
  );
}

function Step({ num, text }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-6 h-6 rounded-full bg-ink-900 text-white text-[10px] font-bold grid place-items-center shrink-0">
        {num}
      </span>
      <p className="text-xs text-ink-700 flex-1">{text}</p>
    </div>
  );
}
