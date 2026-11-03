import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/referral/flagged/:id
 * Body: { action: 'approve' | 'reject' }
 * - approve: clear requires_review (akan auto-credit saat order done)
 * - reject: cancel referral (tidak credit)
 */
export async function PATCH(request, { params }) {
  const auth = request.headers.get('x-admin-password') || '';
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error_code: 1, msg: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const action = String(body.action || '');
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error_code: 1, msg: 'Action tidak valid' },
        { status: 400 }
      );
    }

    const sb = getSupabase();
    const { data: ref } = await sb
      .from('referrals')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (!ref) {
      return NextResponse.json(
        { error_code: 1, msg: 'Tidak ditemukan' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Clear flag — kalau order sudah done, langsung credit
      await sb
        .from('referrals')
        .update({
          requires_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin',
        })
        .eq('id', params.id);

      // Cek status order untuk auto-credit kalau sudah done
      const { data: order } = await sb
        .from('orders')
        .select('status')
        .eq('id', ref.order_id)
        .maybeSingle();

      if (order?.status === 'done' && ref.status === 'pending') {
        const { creditReferralReward } = await import('@/lib/referral');
        await creditReferralReward(sb, ref.order_id);
      }
    } else {
      // Reject → cancel
      await sb
        .from('referrals')
        .update({
          status: 'cancelled',
          requires_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin',
        })
        .eq('id', params.id);
    }

    return NextResponse.json({ error_code: 0 });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal' },
      { status: 500 }
    );
  }
}
