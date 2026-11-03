/**
 * Fraud Score Engine
 *
 * Hitung skor 0-100 berdasarkan sinyal dari order + referrer + referee + device.
 * Threshold:
 *   < 50  → auto-credit
 *   50-99 → flag for review (admin manual)
 *   ≥ 100 → block credit (suspicious)
 */

export async function computeFraudScore(sb, { order, referrer, refereePhone }) {
  const signals = [];
  let score = 0;

  try {
    // === Signal 1: Same fingerprint between referrer & referee
    if (order?.fingerprint) {
      const { data: refDevices } = await sb
        .from('referral_devices')
        .select('fingerprint')
        .eq('phone', referrer.phone)
        .limit(20);

      const referrerFingerprints = new Set((refDevices || []).map((d) => d.fingerprint));
      if (referrerFingerprints.has(order.fingerprint)) {
        score += 60;
        signals.push({ type: 'same_fingerprint', severity: 'high' });
      }
    }

    // === Signal 2: Same IP (recent — 30 days)
    // NOTE: di Indonesia banyak yang share IP (rumah, kantor, hotspot)
    // jadi skor dikecilkan supaya tidak gampang false positive
    if (order?.ip) {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: refIpHistory } = await sb
        .from('referral_devices')
        .select('ip')
        .eq('phone', referrer.phone)
        .gte('created_at', cutoff)
        .limit(50);

      const referrerIps = new Set((refIpHistory || []).map((d) => d.ip));
      if (referrerIps.has(order.ip)) {
        score += 15; // turun dari 40 → 15
        signals.push({ type: 'same_ip', severity: 'low' });
      }
    }

    // === Signal 3: Referrer baru daftar (< 1 jam) lalu langsung ada referral
    if (referrer.created_at) {
      const ageHours =
        (Date.now() - new Date(referrer.created_at).getTime()) / 3600000;
      if (ageHours < 1) {
        score += 30;
        signals.push({ type: 'fresh_referrer', severity: 'medium', ageHours });
      } else if (ageHours < 24) {
        score += 10;
        signals.push({ type: 'young_referrer', severity: 'low', ageHours });
      }
    }

    // === Signal 4: Burst — referrer dapat banyak referral baru dalam waktu pendek
    {
      const cutoff = new Date(Date.now() - 60 * 60000).toISOString(); // 1 jam
      const { count } = await sb
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_phone', referrer.phone)
        .gte('created_at', cutoff);

      if ((count || 0) >= 5) {
        score += 50;
        signals.push({ type: 'burst_high', severity: 'high', count });
      } else if ((count || 0) >= 3) {
        score += 20;
        signals.push({ type: 'burst_medium', severity: 'medium', count });
      }
    }

    // === Signal 5: Referee phone pattern mencurigakan
    if (refereePhone) {
      const local = refereePhone.replace(/^62/, '');
      // Sequential like 081234567890, 081111111111
      if (/^(\d)\1{8,}$/.test(local)) {
        score += 80;
        signals.push({ type: 'fake_phone_pattern', severity: 'critical' });
      }
    }

    // === Signal 6: Referee sudah pernah jadi referee (multiple kali oleh referrer yang sama)
    {
      const { count: sameReferrerCount } = await sb
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referee_phone', refereePhone)
        .eq('referrer_phone', referrer.phone)
        .neq('order_id', order.orderId)
        .in('status', ['pending', 'credited']);

      // Kalau referee sudah pernah dipakai oleh referrer YANG SAMA → suspicious
      if ((sameReferrerCount || 0) >= 3) {
        score += 40;
        signals.push({
          type: 'repeated_same_pair',
          severity: 'high',
          count: sameReferrerCount,
        });
      } else if ((sameReferrerCount || 0) >= 1) {
        score += 10;
        signals.push({
          type: 'repeat_referee',
          severity: 'low',
          count: sameReferrerCount,
        });
      }
    }

    // === Signal 7: Customer name == Referrer name (likely same person)
    if (
      order.customer?.name &&
      referrer.name &&
      normalize(order.customer.name) === normalize(referrer.name)
    ) {
      score += 50;
      signals.push({ type: 'same_name', severity: 'high' });
    }

    // === Signal 8: Banned referrer
    if (referrer.banned) {
      score += 100;
      signals.push({ type: 'referrer_banned', severity: 'critical' });
    }

    // === Signal 9: Audit log shows past blocked actions
    {
      const { count: blockedCount } = await sb
        .from('referral_audit')
        .select('id', { count: 'exact', head: true })
        .eq('phone', referrer.phone)
        .eq('result', 'blocked')
        .limit(1);

      if ((blockedCount || 0) > 0) {
        score += 20;
        signals.push({ type: 'past_blocked', severity: 'medium' });
      }
    }
  } catch (e) {
    console.error('fraudScore error:', e.message);
  }

  return { score: Math.min(100, score), signals };
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
