import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { normalizePhone, isValidPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referral/me?phone=08xxx
 * Cek saldo & info referral berdasarkan nomor WA.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = normalizePhone(searchParams.get('phone'));

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error_code: 1, msg: 'Nomor WhatsApp tidak valid' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    const { data: user } = await sb
      .from('referral_users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({
        error_code: 0,
        data: {
          registered: false,
          phone,
          balance: 0,
          total_earned: 0,
        },
      });
    }

    // Hitung statistik
    const [{ count: totalReferrals }, { count: pendingReferrals }, { data: history }] =
      await Promise.all([
        sb
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_phone', phone)
          .eq('status', 'credited'),
        sb
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_phone', phone)
          .eq('status', 'pending'),
        sb
          .from('referrals')
          .select('*')
          .eq('referrer_phone', phone)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

    const { data: withdrawals } = await sb
      .from('withdrawals')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      error_code: 0,
      data: {
        registered: true,
        ...user,
        stats: {
          total_referrals: totalReferrals || 0,
          pending_referrals: pendingReferrals || 0,
        },
        history: history || [],
        withdrawals: withdrawals || [],
      },
    });
  } catch (e) {
    console.error('referral me error:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal load data' },
      { status: 500 }
    );
  }
}
