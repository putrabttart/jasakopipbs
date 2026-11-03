import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
  cancelReferralReward,
  refundBalanceOnCancel,
} from '@/lib/referral';
import { incrementStock } from '@/lib/accountStock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_TIMEOUT_MIN = 30;

/**
 * Auto-cancel order pending yang belum bayar dalam X menit.
 *
 * Auth options:
 * - Header `Authorization: Bearer ${CRON_SECRET}`  (untuk external cron)
 * - Header `x-vercel-cron: 1` (otomatis di-set Vercel Cron)
 *
 * Bisa dipanggil GET (Vercel Cron) atau POST (external).
 */
function isAuthorized(request) {
  // Vercel Cron sends this header automatically when triggering
  if (request.headers.get('x-vercel-cron')) return true;

  const secret = process.env.CRON_SECRET;
  // Kalau secret belum di-set, allow (dev mode). Untuk production set CRON_SECRET di env.
  if (!secret) return true;

  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function getTimeoutMinutes(sb) {
  try {
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'payment_timeout')
      .maybeSingle();
    const v = parseInt(data?.value?.minutes, 10);
    if (Number.isFinite(v) && v > 0) return v;
  } catch (_) {}
  return DEFAULT_TIMEOUT_MIN;
}

async function runAutoCancel() {
  const sb = getSupabase();
  const timeoutMin = await getTimeoutMinutes(sb);
  const cutoff = new Date(Date.now() - timeoutMin * 60_000).toISOString();

  // Ambil order pending yang sudah lewat cutoff
  const { data: orders, error } = await sb
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', cutoff);

  if (error) throw error;

  let cancelled = 0;
  let skipped = 0;
  const results = [];

  for (const order of orders || []) {
    const d = order.data || {};

    // Skip kalau sudah ada bukti bayar (admin yang verify, jangan cancel)
    if (d.proof_url) {
      skipped++;
      continue;
    }

    const newData = {
      ...d,
      cancel_reason: `Pembayaran tidak diterima dalam ${timeoutMin} menit`,
      auto_cancelled_at: new Date().toISOString(),
    };

    const { error: updErr } = await sb
      .from('orders')
      .update({ status: 'cancelled', data: newData })
      .eq('id', order.id)
      .eq('status', 'pending'); // guard race condition

    if (updErr) {
      results.push({ id: order.id, error: updErr.message });
      continue;
    }

    // Cleanup terkait
    try {
      await cancelReferralReward(sb, order.id);
      await refundBalanceOnCancel(sb, d);
      await incrementStock(sb, 1);
    } catch (e) {
      console.error('cleanup error:', e.message);
    }

    cancelled++;
    results.push({ id: order.id, status: 'cancelled' });
  }

  return { cancelled, skipped, checked: orders?.length || 0, timeoutMin, results };
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Unauthorized' },
      { status: 401 }
    );
  }
  try {
    const result = await runAutoCancel();
    return NextResponse.json({ error_code: 0, ...result });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Unauthorized' },
      { status: 401 }
    );
  }
  try {
    const result = await runAutoCancel();
    return NextResponse.json({ error_code: 0, ...result });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Failed' },
      { status: 500 }
    );
  }
}
