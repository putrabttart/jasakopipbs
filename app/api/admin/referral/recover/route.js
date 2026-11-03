import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { creditReferralReward } from '@/lib/referral';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/referral/recover
 * Admin tool: re-trigger credit untuk semua referral yang status 'pending'
 * dan order-nya sudah `processing` atau `done`.
 *
 * Berguna untuk recovery bug — saldo yang seharusnya sudah masuk tapi belum.
 */
export async function POST(request) {
  const auth = request.headers.get('x-admin-password') || '';
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error_code: 1, msg: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const sb = getSupabase();

    // Ambil semua referrals pending
    const { data: refs } = await sb
      .from('referrals')
      .select('order_id, requires_review, fraud_score')
      .eq('status', 'pending')
      .eq('requires_review', false);

    if (!refs || refs.length === 0) {
      return NextResponse.json({
        error_code: 0,
        data: { recovered: 0, total: 0, results: [] },
      });
    }

    let recovered = 0;
    const results = [];

    for (const ref of refs) {
      // Cek status order
      const { data: order } = await sb
        .from('orders')
        .select('status')
        .eq('id', ref.order_id)
        .maybeSingle();

      if (!order) {
        results.push({ order_id: ref.order_id, status: 'order_not_found' });
        continue;
      }

      // Hanya credit kalau order sudah processing/done/ready
      if (!['processing', 'ready', 'done'].includes(order.status)) {
        results.push({ order_id: ref.order_id, status: 'order_not_ready' });
        continue;
      }

      const result = await creditReferralReward(sb, ref.order_id);
      results.push({
        order_id: ref.order_id,
        ...result,
      });
      if (result.credited) recovered++;
    }

    return NextResponse.json({
      error_code: 0,
      data: { recovered, total: refs.length, results },
    });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Failed' },
      { status: 500 }
    );
  }
}
