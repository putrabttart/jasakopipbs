'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Icon } from '@/components/Icons';
import { isValidPhone } from '@/lib/phone';
import { getFingerprint } from '@/lib/fingerprint';

const STORAGE_KEY = 'referral-phone';

export default function PinPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [hasPin, setHasPin] = useState(null);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : '';
    if (!saved || !isValidPhone(saved)) {
      router.replace('/referral');
      return;
    }
    setPhone(saved);
    fetch(`/api/referral/pin?phone=${encodeURIComponent(saved)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error_code === 0) {
          setHasPin(j.data.has_pin);
        }
      });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (newPin !== confirmPin) {
      setError('Konfirmasi PIN tidak sama');
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      setError('PIN harus 6 digit angka');
      return;
    }

    setLoading(true);
    try {
      const fingerprint = getFingerprint();
      const res = await fetch('/api/referral/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fingerprint': fingerprint,
        },
        body: JSON.stringify({
          phone,
          old_pin: hasPin ? oldPin : '',
          new_pin: newPin,
          fingerprint,
        }),
      });
      const json = await res.json();
      if (json.error_code === 0) {
        setSuccess(true);
        setTimeout(() => router.replace('/withdraw'), 1500);
      } else {
        setError(json.msg || 'Gagal');
      }
    } catch (e) {
      setError(e.message || 'Gagal');
    }
    setLoading(false);
  }

  if (hasPin === null) {
    return (
      <main className="pb-24">
        <Header title="PIN Keamanan" back="/referral" showCart={false} />
        <div className="max-w-md mx-auto px-4 mt-12 text-center">
          <Icon.Spinner size={24} className="text-ink-400 mx-auto" />
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="pb-24">
        <Header title="PIN Keamanan" back="/referral" showCart={false} />
        <div className="max-w-md mx-auto px-4 md:px-6 pt-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500 grid place-items-center text-white mb-3">
            <Icon.Check size={28} strokeWidth={3} />
          </div>
          <p className="text-base font-bold text-ink-900">PIN berhasil disimpan</p>
          <p className="text-xs text-ink-500 mt-1">
            Sebentar, kami arahkan ke halaman penarikan...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-24">
      <Header
        title={hasPin ? 'Ganti PIN' : 'Buat PIN'}
        back="/referral"
        showCart={false}
      />

      <div className="max-w-md mx-auto px-4 md:px-6 pt-3 space-y-3">
        <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-accent-700 text-white p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
              <Icon.Lock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">PIN 6 Digit</p>
              <p className="text-[10px] opacity-80 mt-0.5">
                Wajib untuk semua penarikan saldo
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white border border-ink-200 p-4 space-y-3">
          {hasPin && (
            <div>
              <label className="text-xs font-bold text-ink-900">PIN Lama</label>
              <input
                type="password"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="······"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.3em] font-bold outline-none focus:border-ink-900 focus:bg-white transition"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-ink-900">
              {hasPin ? 'PIN Baru' : 'PIN'}
            </label>
            <p className="text-[10px] text-ink-500 mt-0.5">
              Hindari urutan (123456) atau pengulangan (111111)
            </p>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="······"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.3em] font-bold outline-none focus:border-ink-900 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink-900">Konfirmasi PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="······"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              className="w-full mt-1.5 bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.3em] font-bold outline-none focus:border-ink-900 focus:bg-white transition"
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
            disabled={loading}
            className="w-full bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300 text-white py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
          >
            {loading ? <Icon.Spinner size={14} /> : <Icon.Check size={14} strokeWidth={3} />}
            Simpan PIN
          </button>

          <p className="text-[10px] text-ink-500 text-center leading-relaxed">
            PIN dipakai untuk verifikasi saat tarik saldo. Jangan bagikan ke siapa pun.
          </p>
        </form>
      </div>
    </main>
  );
}
