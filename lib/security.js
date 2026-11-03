/**
 * Security utilities: hashing, rate limit, device fingerprint, audit log
 */
import crypto from 'node:crypto';

// ============== HASHING ==============

export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPin(pin, salt) {
  return crypto
    .pbkdf2Sync(String(pin), salt, 100000, 32, 'sha256')
    .toString('hex');
}

export function verifyPin(pin, hash, salt) {
  if (!pin || !hash || !salt) return false;
  const computed = hashPin(pin, salt);
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(hash, 'hex')
  );
}

export function isValidPin(pin) {
  return /^\d{6}$/.test(String(pin || ''));
}

// PIN tidak boleh sequential (123456, 654321) atau repetitive (111111)
export function isWeakPin(pin) {
  const s = String(pin);
  if (!/^\d{6}$/.test(s)) return true;
  if (/^(.)\1+$/.test(s)) return true; // 111111
  // Sequential ascending
  let asc = true,
    desc = true;
  for (let i = 1; i < s.length; i++) {
    if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== 1) asc = false;
    if (s.charCodeAt(i - 1) - s.charCodeAt(i) !== 1) desc = false;
  }
  if (asc || desc) return true;
  // Common weak PINs
  const weak = ['000000', '123456', '654321', '111222', '121212', '696969'];
  if (weak.includes(s)) return true;
  return false;
}

// ============== RATE LIMIT ==============

/**
 * Simple sliding window rate limit pakai tabel rate_limits di Supabase.
 * limit: max request, windowSec: window dalam detik.
 *
 * Return: { allowed, remaining, retryAfter }
 */
export async function rateLimit(sb, key, limit = 10, windowSec = 60) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSec * 1000);

    // Bersihin expired entries (best-effort)
    await sb.from('rate_limits').delete().lt('expires_at', now.toISOString());

    const { data: existing } = await sb
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (!existing) {
      await sb.from('rate_limits').insert({
        key,
        count: 1,
        window_start: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
      return { allowed: true, remaining: limit - 1, retryAfter: 0 };
    }

    if (new Date(existing.expires_at) < now) {
      // Window expired → reset
      await sb
        .from('rate_limits')
        .update({
          count: 1,
          window_start: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('key', key);
      return { allowed: true, remaining: limit - 1, retryAfter: 0 };
    }

    if (existing.count >= limit) {
      const retryAfter = Math.ceil(
        (new Date(existing.expires_at).getTime() - now.getTime()) / 1000
      );
      return { allowed: false, remaining: 0, retryAfter };
    }

    await sb
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('key', key);

    return {
      allowed: true,
      remaining: limit - existing.count - 1,
      retryAfter: 0,
    };
  } catch (e) {
    console.error('rateLimit error:', e.message);
    // Fail-open agar tidak block sistem kalau DB error
    return { allowed: true, remaining: 0, retryAfter: 0 };
  }
}

// ============== REQUEST META ==============

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return '0.0.0.0';
}

export function getRequestMeta(request, body = {}) {
  return {
    ip: getClientIp(request),
    user_agent: request.headers.get('user-agent') || '',
    fingerprint: body?.fingerprint || request.headers.get('x-fingerprint') || '',
  };
}

// ============== AUDIT LOG ==============

export async function logAudit(sb, { phone, action, result = 'success', detail = {}, meta = {} }) {
  try {
    await sb.from('referral_audit').insert({
      phone: phone || null,
      action,
      result,
      detail,
      ip: meta.ip || null,
      user_agent: meta.user_agent || null,
      fingerprint: meta.fingerprint || null,
    });
  } catch (e) {
    console.error('logAudit error:', e.message);
  }
}

// ============== DEVICE TRACKING ==============

export async function trackDevice(sb, { fingerprint, phone, ip, user_agent, action }) {
  if (!fingerprint || !phone) return;
  try {
    await sb.from('referral_devices').insert({
      fingerprint,
      phone,
      ip: ip || null,
      user_agent: user_agent || null,
      action,
    });
  } catch (e) {
    console.error('trackDevice error:', e.message);
  }
}

// ============== PHONE VALIDATION (KETAT) ==============

const ID_OPERATOR_PREFIXES = [
  // Telkomsel
  '811', '812', '813', '821', '822', '823', '851', '852', '853',
  // Indosat
  '814', '815', '816', '855', '856', '857', '858',
  // XL
  '817', '818', '819', '859', '877', '878',
  // Tri
  '895', '896', '897', '898', '899',
  // Smartfren
  '881', '882', '883', '884', '885', '886', '887', '888', '889',
  // AXIS (sub Indosat tapi prefix beda)
  '831', '832', '833', '838',
  // By.U (sub Telkomsel)
  '850',
];

/**
 * Validasi nomor HP Indonesia ketat.
 * - Format 62XXX, panjang 11-14
 * - Prefix harus dari operator resmi
 * - Tidak boleh sequential / repeating digit pattern
 */
export function isValidIndonesianPhone(phone62) {
  if (!/^62[0-9]{9,12}$/.test(phone62)) return false;

  const local = phone62.slice(2); // tanpa 62
  // Cek prefix 3 digit pertama
  const prefix = local.slice(0, 3);
  if (!ID_OPERATOR_PREFIXES.includes(prefix)) return false;

  // Anti pattern obvious fake: aaaaaaaaaa, 1234567890, etc
  if (/^(\d)\1{8,}$/.test(local)) return false;
  if (/^0123456789$/.test(local) || /^9876543210$/.test(local)) return false;

  return true;
}
