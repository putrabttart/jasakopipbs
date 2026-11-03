import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import {
  rateLimit,
  getRequestMeta,
  logAudit,
  trackDevice,
  verifyPin,
  isValidPin,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

const ALLOWED_METHODS = ['dana', 'shopeepay', 'seabank'];

/**
 * POST /api/referral/withdraw
 * Body: { phone, amount, method, account_number, account_name, pin, fingerprint? }
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
  const amount = Math.floor(Number(body.amount) || 0);
  const method = String(body.method || '').toLowerCase();
  const account_number = String(body.account_number || '').trim();
  const account_name = String(body.account_name || '').trim();
  const pin = String(body.pin || '');

  // Basic validation
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Nomor WhatsApp tidak valid' },
      { status: 400 }
    );
  }
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Metode tidak didukung' },
      { status: 400 }
    );
  }
  if (!account_number || !account_name) {
    return NextResponse.json(
      { error_code: 1, msg: 'Nomor & nama akun wajib diisi' },
      { status: 400 }
    );
  }
  if (!isValidPin(pin)) {
    return NextResponse.json(
      { error_code: 1, msg: 'PIN harus 6 digit angka' },
      { status: 400 }
    );
  }

  // Rate limit per IP — max 5 withdraw attempt per jam
  const ipLimit = await rateLimit(sb, `withdraw:ip:${meta.ip}`, 5, 3600);
  if (!ipLimit.allowed) {
    await logAudit(sb, {
      phone,
      action: 'withdraw',
      result: 'blocked',
      detail: { reason: 'rate_limit_ip', retryAfter: ipLimit.retryAfter },
      meta,
    });
    return NextResponse.json(
      {
        error_code: 1,
        msg: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.',
      },
      { status: 429 }
    );
  }

  // Rate limit per phone — max 10 attempt per jam
  const phoneLimit = await rateLimit(sb, `withdraw:ph:${phone}`, 10, 3600);
  if (!phoneLimit.allowed) {
    await logAudit(sb, {
      phone,
      action: 'withdraw',
      result: 'blocked',
      detail: { reason: 'rate_limit_phone' },
      meta,
    });
    return NextResponse.json(
      { error_code: 1, msg: 'Terlalu banyak percobaan. Coba lagi nanti.' },
      { status: 429 }
    );
  }

  try {
    // Get config
    const { data: cfg } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'referral_config')
      .maybeSingle();
    const minWithdraw = cfg?.value?.min_withdraw ?? 10000;

    const { data: secCfg } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'referral_security')
      .maybeSingle();
    const cooldownHours = secCfg?.value?.withdraw_cooldown_hours ?? 0;
    const maxPerDay = secCfg?.value?.max_withdraw_per_day ?? 3;
    const maxAttempts = secCfg?.value?.pin_max_attempts ?? 5;
    const lockoutMin = secCfg?.value?.pin_lockout_minutes ?? 60;

    if (amount < minWithdraw) {
      return NextResponse.json(
        {
          error_code: 1,
          msg: `Minimum penarikan Rp ${minWithdraw.toLocaleString('id-ID')}`,
        },
        { status: 400 }
      );
    }

    // Get user
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
      await logAudit(sb, {
        phone,
        action: 'withdraw',
        result: 'blocked',
        detail: { reason: 'banned' },
        meta,
      });
      return NextResponse.json(
        { error_code: 1, msg: 'Akun diblokir. Hubungi admin.' },
        { status: 403 }
      );
    }

    // PIN belum di-set
    if (!user.pin_hash || !user.pin_salt) {
      return NextResponse.json(
        {
          error_code: 1,
          msg: 'PIN belum dibuat. Buat PIN dulu di halaman PIN.',
          code: 'pin_required',
        },
        { status: 400 }
      );
    }

    // PIN locked
    if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.pin_locked_until).getTime() - Date.now()) / 60000
      );
      await logAudit(sb, {
        phone,
        action: 'withdraw',
        result: 'blocked',
        detail: { reason: 'pin_locked', minutesLeft },
        meta,
      });
      return NextResponse.json(
        {
          error_code: 1,
          msg: `PIN terkunci. Coba lagi dalam ${minutesLeft} menit.`,
        },
        { status: 403 }
      );
    }

    // Verify PIN
    const pinOk = verifyPin(pin, user.pin_hash, user.pin_salt);
    if (!pinOk) {
      const newAttempts = (user.pin_attempts || 0) + 1;
      const updates = { pin_attempts: newAttempts };
      if (newAttempts >= maxAttempts) {
        updates.pin_locked_until = new Date(
          Date.now() + lockoutMin * 60000
        ).toISOString();
        updates.pin_attempts = 0;
      }
      await sb.from('referral_users').update(updates).eq('phone', phone);

      await logAudit(sb, {
        phone,
        action: 'withdraw',
        result: 'failed',
        detail: { reason: 'wrong_pin', attempts: newAttempts },
        meta,
      });

      return NextResponse.json(
        {
          error_code: 1,
          msg:
            newAttempts >= maxAttempts
              ? `PIN salah. Akun terkunci ${lockoutMin} menit.`
              : `PIN salah. Sisa percobaan: ${maxAttempts - newAttempts}`,
        },
        { status: 401 }
      );
    }

    // Reset PIN attempts on success
    if (user.pin_attempts > 0) {
      await sb
        .from('referral_users')
        .update({ pin_attempts: 0, pin_locked_until: null })
        .eq('phone', phone);
    }

    // Saldo cukup
    if (user.balance < amount) {
      return NextResponse.json(
        { error_code: 1, msg: 'Saldo tidak mencukupi' },
        { status: 400 }
      );
    }

    // Cooldown setelah first credit (kalau di-set > 0)
    if (cooldownHours > 0 && user.first_credit_at) {
      const sinceFirstCredit =
        (Date.now() - new Date(user.first_credit_at).getTime()) / 3600000;
      if (sinceFirstCredit < cooldownHours) {
        const remaining = Math.ceil(cooldownHours - sinceFirstCredit);
        await logAudit(sb, {
          phone,
          action: 'withdraw',
          result: 'blocked',
          detail: { reason: 'cooldown', remainingHours: remaining },
          meta,
        });
        return NextResponse.json(
          {
            error_code: 1,
            msg: `Withdraw tersedia ${remaining} jam lagi.`,
          },
          { status: 400 }
        );
      }
    }

    // Cek max withdraw per hari
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: todayCount } = await sb
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', startOfDay.toISOString())
      .in('status', ['pending', 'processing', 'completed']);

    if ((todayCount || 0) >= maxPerDay) {
      await logAudit(sb, {
        phone,
        action: 'withdraw',
        result: 'blocked',
        detail: { reason: 'max_per_day', count: todayCount },
        meta,
      });
      return NextResponse.json(
        {
          error_code: 1,
          msg: `Maksimum ${maxPerDay} penarikan per hari. Coba lagi besok.`,
        },
        { status: 400 }
      );
    }

    // Cek pending withdrawal active
    const { data: pending } = await sb
      .from('withdrawals')
      .select('id')
      .eq('phone', phone)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (pending && pending.length > 0) {
      return NextResponse.json(
        { error_code: 1, msg: 'Masih ada penarikan yang sedang diproses' },
        { status: 400 }
      );
    }

    // Potong saldo (atomic-ish: pakai filter balance saat update)
    const { data: updated, error: updErr } = await sb
      .from('referral_users')
      .update({
        balance: user.balance - amount,
        last_withdraw_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone)
      .gte('balance', amount)
      .select()
      .maybeSingle();

    if (updErr || !updated) {
      return NextResponse.json(
        { error_code: 1, msg: 'Gagal proses penarikan (saldo berubah)' },
        { status: 400 }
      );
    }

    // Buat record withdraw
    const { data: wd, error: wdErr } = await sb
      .from('withdrawals')
      .insert({
        phone,
        amount,
        method,
        account_number,
        account_name,
        status: 'pending',
        notes: meta.fingerprint
          ? `fp=${meta.fingerprint.slice(0, 12)}`
          : null,
      })
      .select()
      .single();

    if (wdErr) {
      // Rollback saldo
      await sb
        .from('referral_users')
        .update({ balance: user.balance })
        .eq('phone', phone);
      throw wdErr;
    }

    await trackDevice(sb, {
      fingerprint: meta.fingerprint,
      phone,
      ip: meta.ip,
      user_agent: meta.user_agent,
      action: 'withdraw',
    });
    await logAudit(sb, {
      phone,
      action: 'withdraw',
      result: 'success',
      detail: { amount, method, withdraw_id: wd.id },
      meta,
    });

    return NextResponse.json({
      error_code: 0,
      data: { ...wd, new_balance: updated.balance },
    });
  } catch (e) {
    console.error('withdraw error:', e.message);
    await logAudit(sb, {
      phone,
      action: 'withdraw',
      result: 'failed',
      detail: { reason: 'exception', error: e.message },
      meta,
    });
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal proses penarikan' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/referral/withdraw — admin list semua withdrawal
 */
export async function GET(request) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from('withdrawals')
      .select('*')
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
