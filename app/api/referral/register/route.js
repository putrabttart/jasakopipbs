import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import {
  generateReferralCodeFromName,
  generateReferralCode,
} from '@/lib/referralCode';
import {
  rateLimit,
  getRequestMeta,
  logAudit,
  trackDevice,
  isValidIndonesianPhone,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Register / get referral user.
 * Body: { phone, name, fingerprint? }
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
  const name = (body.name || '').trim();

  // Validate
  if (!isValidPhone(phone)) {
    await logAudit(sb, {
      phone: phone || null,
      action: 'register',
      result: 'failed',
      detail: { reason: 'invalid_phone' },
      meta,
    });
    return NextResponse.json(
      { error_code: 1, msg: 'Nomor WhatsApp tidak valid' },
      { status: 400 }
    );
  }

  // Strict Indonesia phone check
  if (!isValidIndonesianPhone(phone)) {
    await logAudit(sb, {
      phone,
      action: 'register',
      result: 'blocked',
      detail: { reason: 'non_indonesian_phone' },
      meta,
    });
    return NextResponse.json(
      { error_code: 1, msg: 'Nomor WhatsApp Indonesia tidak valid' },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error_code: 1, msg: 'Nama wajib diisi' },
      { status: 400 }
    );
  }

  // Rate limit per IP (max 5 register / hour) — anti farm
  const ipLimit = await rateLimit(sb, `register:ip:${meta.ip}`, 5, 3600);
  if (!ipLimit.allowed) {
    await logAudit(sb, {
      phone,
      action: 'register',
      result: 'blocked',
      detail: { reason: 'rate_limit_ip', retryAfter: ipLimit.retryAfter },
      meta,
    });
    return NextResponse.json(
      {
        error_code: 1,
        msg: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.',
      },
      { status: 429 }
    );
  }

  // Rate limit per fingerprint (max 3 register / day)
  if (meta.fingerprint) {
    const fpLimit = await rateLimit(
      sb,
      `register:fp:${meta.fingerprint}`,
      3,
      86400
    );
    if (!fpLimit.allowed) {
      await logAudit(sb, {
        phone,
        action: 'register',
        result: 'blocked',
        detail: { reason: 'rate_limit_fingerprint' },
        meta,
      });
      return NextResponse.json(
        {
          error_code: 1,
          msg: 'Terlalu banyak akun dari device ini. Hanya 3 akun per device per hari.',
        },
        { status: 429 }
      );
    }
  }

  try {
    // Cek existing
    const { data: existing } = await sb
      .from('referral_users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      if (existing.banned) {
        await logAudit(sb, {
          phone,
          action: 'register',
          result: 'blocked',
          detail: { reason: 'banned', ban_reason: existing.ban_reason },
          meta,
        });
        return NextResponse.json(
          { error_code: 1, msg: 'Akun ini diblokir. Hubungi admin.' },
          { status: 403 }
        );
      }
      // Update nama kalau berubah
      if (name && existing.name !== name) {
        await sb
          .from('referral_users')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('phone', phone);
        existing.name = name;
      }
      await trackDevice(sb, {
        fingerprint: meta.fingerprint,
        phone,
        ip: meta.ip,
        user_agent: meta.user_agent,
        action: 'login',
      });
      return NextResponse.json({ error_code: 0, data: existing });
    }

    // Generate kode
    let code = '';
    for (let i = 0; i < 8; i++) {
      const candidate = generateReferralCodeFromName(name);
      const { data: dup } = await sb
        .from('referral_users')
        .select('id')
        .eq('referral_code', candidate)
        .maybeSingle();
      if (!dup) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      for (let i = 0; i < 5; i++) {
        const candidate = generateReferralCode();
        const { data: dup } = await sb
          .from('referral_users')
          .select('id')
          .eq('referral_code', candidate)
          .maybeSingle();
        if (!dup) {
          code = candidate;
          break;
        }
      }
    }

    if (!code) {
      return NextResponse.json(
        { error_code: 1, msg: 'Gagal generate kode' },
        { status: 500 }
      );
    }

    const { data: created, error } = await sb
      .from('referral_users')
      .insert({
        phone,
        name,
        referral_code: code,
        balance: 0,
        total_earned: 0,
        register_ip: meta.ip,
        register_fingerprint: meta.fingerprint || null,
      })
      .select()
      .single();

    if (error) throw error;

    await trackDevice(sb, {
      fingerprint: meta.fingerprint,
      phone,
      ip: meta.ip,
      user_agent: meta.user_agent,
      action: 'register',
    });
    await logAudit(sb, {
      phone,
      action: 'register',
      result: 'success',
      detail: { code },
      meta,
    });

    return NextResponse.json({ error_code: 0, data: created });
  } catch (e) {
    console.error('referral register error:', e.message);
    await logAudit(sb, {
      phone,
      action: 'register',
      result: 'failed',
      detail: { reason: 'exception', error: e.message },
      meta,
    });
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal daftar' },
      { status: 500 }
    );
  }
}
