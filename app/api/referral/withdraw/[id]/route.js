import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/referral/withdraw/:id
 * Admin-only: update status withdrawal (pending → processing → completed/rejected)
 * Kalau rejected, saldo dikembalikan ke user.
 */
export async function PATCH(request, { params }) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const status = String(body.status || '');
    const notes = String(body.notes || '');

    if (!['processing', 'completed', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error_code: 1, msg: 'Status tidak valid' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // Get withdrawal
    const { data: wd } = await sb
      .from('withdrawals')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (!wd) {
      return NextResponse.json(
        { error_code: 1, msg: 'Withdrawal tidak ditemukan' },
        { status: 404 }
      );
    }

    // Kalau rejected → kembalikan saldo
    if (status === 'rejected' && wd.status !== 'rejected') {
      const { data: user } = await sb
        .from('referral_users')
        .select('balance')
        .eq('phone', wd.phone)
        .maybeSingle();

      if (user) {
        await sb
          .from('referral_users')
          .update({
            balance: user.balance + wd.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('phone', wd.phone);
      }
    }

    // Update withdrawal
    const update = {
      status,
      notes: notes || wd.notes,
    };
    if (['completed', 'rejected'].includes(status)) {
      update.processed_at = new Date().toISOString();
    }

    const { error } = await sb
      .from('withdrawals')
      .update(update)
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ error_code: 0 });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal update' },
      { status: 500 }
    );
  }
}
