import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/referral/users/:phone
 * Body: { banned, ban_reason, balance_adjust, reset_pin }
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
    const sb = getSupabase();

    const updates = { updated_at: new Date().toISOString() };

    if (typeof body.banned === 'boolean') {
      updates.banned = body.banned;
      updates.ban_reason = body.ban_reason || null;
    }

    if (body.reset_pin === true) {
      updates.pin_hash = null;
      updates.pin_salt = null;
      updates.pin_attempts = 0;
      updates.pin_locked_until = null;
    }

    if (typeof body.balance_adjust === 'number') {
      const { data: user } = await sb
        .from('referral_users')
        .select('balance')
        .eq('phone', params.phone)
        .maybeSingle();
      if (user) {
        updates.balance = Math.max(0, user.balance + body.balance_adjust);
      }
    }

    await sb.from('referral_users').update(updates).eq('phone', params.phone);

    return NextResponse.json({ error_code: 0 });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal' },
      { status: 500 }
    );
  }
}
