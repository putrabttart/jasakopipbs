/**
 * Helpers untuk logic referral & saldo (dengan fraud detection ringan)
 */
import { normalizePhone } from './phone';
import { computeFraudScore } from './fraudScore';

const MIN_ORDER_DEFAULT = 0;
const FRAUD_THRESHOLD_REVIEW = 80;   // longgarkan dari 50 → 80
const FRAUD_THRESHOLD_BLOCK = 150;   // longgarkan dari 100 → 150 (efektif tidak block normal)

async function getSecurityConfig(sb) {
  try {
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'referral_security')
      .maybeSingle();
    return data?.value || {};
  } catch (_) {
    return {};
  }
}

/**
 * Saat order baru dibuat — kalau ada referral_code valid & customer beda nomor,
 * insert baris ke `referrals` dengan status 'pending' + fraud score.
 *
 * Return: { ok, attached, reason, score?, requires_review? }
 */
export async function attachReferralToOrder(sb, order) {
  try {
    const code = (order.referralCode || '').toUpperCase().trim();
    if (!code) return { ok: true, attached: false, reason: 'no_code' };

    const refereePhone = normalizePhone(order.customer?.phone);
    if (!refereePhone) return { ok: true, attached: false, reason: 'no_phone' };

    // Cari referrer
    const { data: referrer } = await sb
      .from('referral_users')
      .select('*')
      .eq('referral_code', code)
      .maybeSingle();

    if (!referrer) {
      console.warn('[referral] code not found:', code);
      return { ok: true, attached: false, reason: 'not_found' };
    }

    // BLOCK self-referral (server-side enforcement)
    if (referrer.phone === refereePhone) {
      return { ok: false, reason: 'self_referral' };
    }

    // BLOCK kalau referrer banned
    if (referrer.banned) {
      return { ok: false, reason: 'referrer_banned' };
    }

    // Get config
    const security = await getSecurityConfig(sb);
    const minOrder = security.min_order_for_referral ?? MIN_ORDER_DEFAULT;
    const reviewThreshold = security.fraud_threshold_review ?? FRAUD_THRESHOLD_REVIEW;
    const blockThreshold = security.fraud_threshold_block ?? FRAUD_THRESHOLD_BLOCK;

    const { data: cfg } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'referral_config')
      .maybeSingle();

    if (cfg?.value && cfg.value.enabled === false) {
      return { ok: true, attached: false, reason: 'disabled' };
    }
    const reward = cfg?.value?.reward ?? 2000;

    // BLOCK kalau order amount terlalu kecil (hanya kalau minOrder > 0)
    const orderTotal = Number(order.total || 0);
    if (minOrder > 0 && orderTotal < minOrder) {
      return {
        ok: true,
        attached: false,
        reason: 'min_order_not_met',
        minOrder,
      };
    }

    // Compute fraud score
    const { score, signals } = await computeFraudScore(sb, {
      order,
      referrer,
      refereePhone,
    });

    // BLOCK kalau score sangat tinggi
    if (score >= blockThreshold) {
      console.warn('[referral] BLOCKED — score too high:', score, signals);
      return {
        ok: false,
        reason: 'fraud_blocked',
        score,
        signals,
      };
    }

    const requiresReview = score >= reviewThreshold;
    if (requiresReview) {
      console.warn('[referral] FLAG REVIEW — score:', score, signals);
    }

    const { error: insErr } = await sb.from('referrals').insert({
      referrer_phone: referrer.phone,
      referrer_code: referrer.referral_code,
      referee_phone: refereePhone,
      referee_name: order.customer?.name || null,
      order_id: order.orderId,
      reward,
      status: 'pending',
      fraud_score: score,
      fraud_signals: signals,
      requires_review: requiresReview,
    });

    if (insErr) {
      console.error('[referral] insert failed:', insErr.message);
      return { ok: true, attached: false, reason: 'insert_failed' };
    }

    console.log(
      `[referral] attached: ${referrer.referral_code} → order ${order.orderId} (score=${score}, review=${requiresReview})`
    );

    return {
      ok: true,
      attached: true,
      score,
      requires_review: requiresReview,
    };
  } catch (e) {
    console.error('attachReferralToOrder error:', e.message);
    return { ok: true, attached: false, reason: 'error' };
  }
}

/**
 * Credit reward ke referrer.
 * Dipanggil saat order status → processing ATAU done (yang dulu duluan).
 * Idempotent: kalau sudah credited, tidak akan dobel.
 */
export async function creditReferralReward(sb, orderId) {
  try {
    const { data: ref } = await sb
      .from('referrals')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!ref) {
      console.log(`[credit] no referral for order ${orderId}`);
      return { credited: false, reason: 'no_referral' };
    }

    if (ref.status === 'credited') {
      console.log(`[credit] already credited: ${ref.id}`);
      return { credited: false, reason: 'already_credited' };
    }

    if (ref.status === 'cancelled') {
      console.log(`[credit] already cancelled: ${ref.id}`);
      return { credited: false, reason: 'cancelled' };
    }

    // SKIP kalau butuh review (admin harus approve dulu)
    if (ref.requires_review) {
      console.log(`[credit] requires admin review: ${ref.id} (score=${ref.fraud_score})`);
      return { credited: false, reason: 'requires_review' };
    }

    const { data: user } = await sb
      .from('referral_users')
      .select('*')
      .eq('phone', ref.referrer_phone)
      .maybeSingle();

    if (!user) {
      console.error(`[credit] referrer not found: ${ref.referrer_phone}`);
      return { credited: false, reason: 'referrer_not_found' };
    }
    if (user.banned) return { credited: false, reason: 'referrer_banned' };

    const newBalance = (user.balance || 0) + ref.reward;
    const newEarned = (user.total_earned || 0) + ref.reward;
    const updates = {
      balance: newBalance,
      total_earned: newEarned,
      updated_at: new Date().toISOString(),
    };
    if (!user.first_credit_at) updates.first_credit_at = new Date().toISOString();

    const { error: updErr } = await sb
      .from('referral_users')
      .update(updates)
      .eq('phone', ref.referrer_phone);

    if (updErr) {
      console.error('[credit] balance update failed:', updErr.message);
      return { credited: false, reason: 'update_failed' };
    }

    await sb
      .from('referrals')
      .update({
        status: 'credited',
        credited_at: new Date().toISOString(),
      })
      .eq('id', ref.id);

    console.log(
      `[credit] +Rp ${ref.reward} → ${ref.referrer_phone} (balance: ${newBalance})`
    );

    return { credited: true, amount: ref.reward, newBalance };
  } catch (e) {
    console.error('creditReferralReward error:', e.message);
    return { credited: false, reason: 'error' };
  }
}

/**
 * Saat order cancelled → tandai referral cancelled. Kalau sudah credited → kurangi saldo.
 */
export async function cancelReferralReward(sb, orderId) {
  try {
    const { data: ref } = await sb
      .from('referrals')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!ref) return;
    if (ref.status === 'cancelled') return;

    if (ref.status === 'credited') {
      const { data: user } = await sb
        .from('referral_users')
        .select('balance, total_earned')
        .eq('phone', ref.referrer_phone)
        .maybeSingle();

      if (user) {
        await sb
          .from('referral_users')
          .update({
            balance: Math.max(0, (user.balance || 0) - ref.reward),
            total_earned: Math.max(0, (user.total_earned || 0) - ref.reward),
            updated_at: new Date().toISOString(),
          })
          .eq('phone', ref.referrer_phone);
        console.log(`[cancel] reverted Rp ${ref.reward} from ${ref.referrer_phone}`);
      }
    }

    await sb.from('referrals').update({ status: 'cancelled' }).eq('id', ref.id);
  } catch (e) {
    console.error('cancelReferralReward error:', e.message);
  }
}

/**
 * Apply pemakaian saldo: potong saldo customer saat order dibuat.
 */
export async function applyBalanceToOrder(sb, order) {
  try {
    const used = Math.max(0, Math.floor(Number(order.balanceUsed) || 0));
    if (!used) return { applied: 0 };

    const phone = normalizePhone(order.customer?.phone);
    if (!phone) {
      console.warn('[balance] no phone for order', order.orderId);
      return { applied: 0 };
    }

    const { data: user } = await sb
      .from('referral_users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) {
      console.warn(`[balance] user not registered: ${phone}`);
      return { applied: 0 };
    }
    if (user.banned) {
      console.warn(`[balance] user banned: ${phone}`);
      return { applied: 0 };
    }
    if ((user.balance || 0) <= 0) {
      console.warn(`[balance] no balance: ${phone}`);
      return { applied: 0 };
    }

    const apply = Math.min(used, user.balance);

    // Atomic update: pakai gte guard
    const { data: updated, error } = await sb
      .from('referral_users')
      .update({
        balance: user.balance - apply,
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone)
      .gte('balance', apply)
      .select()
      .maybeSingle();

    if (error || !updated) {
      console.error(
        '[balance] update failed:',
        error?.message || 'race condition'
      );
      return { applied: 0 };
    }

    console.log(
      `[balance] -Rp ${apply} from ${phone} (was ${user.balance}, now ${updated.balance})`
    );
    return { applied: apply };
  } catch (e) {
    console.error('applyBalanceToOrder error:', e.message);
    return { applied: 0 };
  }
}

/**
 * Refund balance kalau order di-cancel.
 */
export async function refundBalanceOnCancel(sb, order) {
  try {
    const used = Math.max(0, Math.floor(Number(order.balanceUsed) || 0));
    if (!used) return;

    const phone = normalizePhone(order.customer?.phone);
    if (!phone) return;

    const { data: user } = await sb
      .from('referral_users')
      .select('balance')
      .eq('phone', phone)
      .maybeSingle();

    if (!user) return;

    await sb
      .from('referral_users')
      .update({
        balance: (user.balance || 0) + used,
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone);

    console.log(`[refund] +Rp ${used} → ${phone}`);
  } catch (e) {
    console.error('refundBalanceOnCancel error:', e.message);
  }
}
