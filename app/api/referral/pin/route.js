import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import {
  rateLimit,
  getRequestMeta,
  logAudit,
  generateSalt,
  hashPin,
  verifyPin,
  isValidPin,
  isWeakPin,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * POST /api/referral/pin
 * Body untuk set pertama kali: { phone, new_pin }
 * Body untuk ganti PIN: { phone, old_pin, new_pin }
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json(
      { error_code: 1, msg: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const sb = getSupabase();
  const meta = getRequestMeta(request, body);
  const phone = normalizePhone(body.phone);
  const new_pin = String(body.new_pin || '');
  const old_pin = String(body.old_pin || '');

  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Nomor WhatsApp tidak valid' },
      { status: 400 }
    );
  }

  if (!isValidPin(new_pin)) {
    return NextResponse.json(
      { error_code: 1, msg: 'PIN harus 6 digit angka' },
      { status: 400 }
    );
  }

  if (isWeakPin(new_pin)) {
    return NextResponse.json(
      {
        error_code: 1,
        msg: 'PIN terlalu lemah. Hindari urutan (123456) atau pengulangan (111111).',
      },
      { status: 400 }
    );
  }

  // Rate limit per IP
  const ipLimit = await rateLimit(sb, `pin:ip:${meta.ip}`, 10, 3600);
  if (!ipLimit.allowed) {
    await logAudit(sb, {
      phone,
      action: 'set_pin',
      result: 'blocked',
      detail: { reason: 'rate_limit_ip' },
      meta,
    });
    return NextResponse.json(
      { error_code: 1, msg: 'Terlalu banyak percobaan. Coba lagi nanti.' },
      { status: 429 }
    );
  }

  // Rate limit per phone
  const phoneLimit = await rateLimit(sb, `pin:ph:${phone}`, 5, 3600);
  if (!phoneLimit.allowed) {
    return NextResponse.json(
      { error_code: 1, msg: 'Terlalu banyak percobaan untuk nomor ini.' },
      { status: 429 }
    );
  }

  try {
    const { data: user } = await sb
      .from('referral_users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { error_code: 1, msg: 'Akun tidak ditemukan' },
        { status: 404 }
      );
    }

    if (user.banned) {
      return NextResponse.json(
        { error_code: 1, msg: 'Akun diblokir.' },
        { status: 403 }
      );
    }

    // Kalau sudah ada PIN → wajib old_pin
    if (user.pin_hash && user.pin_salt) {
      if (!old_pin) {
        return NextResponse.json(
          { error_code: 1, msg: 'PIN lama wajib diisi' },
          { status: 400 }
        );
      }

      // Cek lockout
      if (
        user.pin_locked_until &&
        new Date(user.pin_locked_until) > new Date()
      ) {
        return NextResponse.json(
          { error_code: 1, msg: 'PIN terkunci. Coba lagi nanti.' },
          { status: 403 }
        );
      }

      const ok = verifyPin(old_pin, user.pin_hash, user.pin_salt);
      if (!ok) {
        const newAttempts = (user.pin_attempts || 0) + 1;
        const updates = { pin_attempts: newAttempts };
        if (newAttempts >= 5) {
          updates.pin_locked_until = new Date(Date.now() + 60 * 60000).toISOString();
          updates.pin_attempts = 0;
        }
        await sb.from('referral_users').update(updates).eq('phone', phone);

        await logAudit(sb, {
          phone,
          action: 'change_pin',
          result: 'failed',
          detail: { reason: 'wrong_old_pin', attempts: newAttempts },
          meta,
        });
        return NextResponse.json(
          { error_code: 1, msg: 'PIN lama salah' },
          { status: 401 }
        );
      }
    }

    // Set / update PIN
    const salt = generateSalt();
    const hash = hashPin(new_pin, salt);

    await sb
      .from('referral_users')
      .update({
        pin_hash: hash,
        pin_salt: salt,
        pin_attempts: 0,
        pin_locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone);

    await logAudit(sb, {
      phone,
      action: user.pin_hash ? 'change_pin' : 'set_pin',
      result: 'success',
      detail: {},
      meta,
    });

    return NextResponse.json({ error_code: 0, msg: 'PIN berhasil disimpan' });
  } catch (e) {
    console.error('pin error:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/referral/pin/status?phone=08xx
 * Cek apakah user sudah punya PIN atau belum.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const phone = normalizePhone(searchParams.get('phone'));

  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Nomor tidak valid' },
      { status: 400 }
    );
  }

  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('referral_users')
      .select('pin_hash, pin_locked_until, pin_attempts, banned')
      .eq('phone', phone)
      .maybeSingle();

    if (!data) {
      return NextResponse.json(
        { error_code: 1, msg: 'Akun tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      error_code: 0,
      data: {
        has_pin: !!data.pin_hash,
        locked: data.pin_locked_until
          ? new Date(data.pin_locked_until) > new Date()
          : false,
        locked_until: data.pin_locked_until,
        banned: data.banned,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal' },
      { status: 500 }
    );
  }
}
