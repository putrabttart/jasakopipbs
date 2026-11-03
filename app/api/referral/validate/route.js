import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referral/validate?code=KKxxxx&phone=08xx
 * Validasi kode referral saat checkout.
 * - Kode harus ada
 * - Phone wajib ada untuk cek self-referral
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim().toUpperCase();
    const phone = (searchParams.get('phone') || '').trim();

    if (!code) {
      return NextResponse.json(
        { error_code: 1, msg: 'Kode referral kosong' },
        { status: 400 }
      );
    }

    const sb = getSupabase();
    const { data: referrer } = await sb
      .from('referral_users')
      .select('phone, name, referral_code')
      .eq('referral_code', code)
      .maybeSingle();

    if (!referrer) {
      return NextResponse.json(
        { error_code: 1, msg: 'Kode referral tidak ditemukan' },
        { status: 404 }
      );
    }

    // Self-referral check — phone wajib ada agar kode tidak lolos sebelum input nomor
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return NextResponse.json(
        {
          error_code: 1,
          msg: 'Isi nomor WhatsApp dulu untuk cek kode referral',
          code: 'phone_required',
        },
        { status: 400 }
      );
    }

    if (normalized === referrer.phone) {
      return NextResponse.json(
        {
          error_code: 1,
          msg: 'Tidak bisa pakai kode referral milikmu sendiri',
          code: 'self_referral',
        },
        { status: 400 }
      );
    }

    // Get reward config
    const { data: cfg } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'referral_config')
      .maybeSingle();

    const reward = cfg?.value?.reward ?? 2000;

    return NextResponse.json({
      error_code: 0,
      data: {
        code: referrer.referral_code,
        referrer_phone: referrer.phone,
        referrer_name: referrer.name || 'Pengguna',
        reward,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal validasi kode' },
      { status: 500 }
    );
  }
}
