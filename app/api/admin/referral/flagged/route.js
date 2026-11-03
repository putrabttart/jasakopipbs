import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/referral/flagged
 * List referrals yang requires_review (admin perlu approve)
 */
export async function GET(request) {
  const auth = request.headers.get('x-admin-password') || '';
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error_code: 1, msg: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('referrals')
      .select('*')
      .eq('requires_review', true)
      .is('reviewed_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ error_code: 0, data: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal load' },
      { status: 500 }
    );
  }
}
