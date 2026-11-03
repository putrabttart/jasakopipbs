import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { attachReferralToOrder, applyBalanceToOrder } from '@/lib/referral';
import { normalizePhone } from '@/lib/phone';
import { getRequestMeta, logAudit, trackDevice } from '@/lib/security';
import { decrementStock, checkStockAvailable } from '@/lib/accountStock';

export const dynamic = 'force-dynamic';

// POST: simpan order baru
export async function POST(request) {
  const sb = getSupabase();
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json(
      { error_code: 1, msg: 'Invalid JSON' },
      { status: 400 }
    );
  }

  if (!body || !body.orderId || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Data order tidak valid' },
      { status: 400 }
    );
  }

  const meta = getRequestMeta(request, body);

  // Inject IP & fingerprint ke order untuk fraud detection
  body.ip = meta.ip;
  body.fingerprint = meta.fingerprint || body.fingerprint || '';

  // === Cek stok akun BEFORE memproses apapun ===
  const stockCheck = await checkStockAvailable(sb);
  if (!stockCheck.ok) {
    await logAudit(sb, {
      phone: normalizePhone(body.customer?.phone) || null,
      action: 'order_create',
      result: 'blocked',
      detail: { reason: 'stock_empty' },
      meta,
    });
    return NextResponse.json(
      {
        error_code: 1,
        msg: stockCheck.message,
        code: 'stock_unavailable',
      },
      { status: 503 }
    );
  }

  try {
    // Validasi referral code SEBELUM insert order — block self-referral
    if (body.referralCode) {
      const code = String(body.referralCode).trim().toUpperCase();
      const refereePhone = normalizePhone(body.customer?.phone);

      const { data: referrer } = await sb
        .from('referral_users')
        .select('phone')
        .eq('referral_code', code)
        .maybeSingle();

      if (referrer && refereePhone && referrer.phone === refereePhone) {
        await logAudit(sb, {
          phone: refereePhone,
          action: 'order_referral',
          result: 'blocked',
          detail: { reason: 'self_referral', code },
          meta,
        });
        return NextResponse.json(
          {
            error_code: 1,
            msg: 'Tidak bisa pakai kode referral milikmu sendiri.',
          },
          { status: 400 }
        );
      }

      if (!referrer) body.referralCode = '';
    }

    // Apply balance
    const { applied } = await applyBalanceToOrder(sb, body);
    if (applied !== body.balanceUsed) {
      const diff = (Number(body.balanceUsed) || 0) - applied;
      body.balanceUsed = applied;
      body.totalToPay = (Number(body.totalToPay) || 0) + diff;
    }

    // Decrement stok atomically (race-condition aman)
    const stockResult = await decrementStock(sb);
    if (!stockResult.ok) {
      // Stok habis di antara check & decrement
      // Refund balance
      if (applied > 0) {
        const phone = normalizePhone(body.customer?.phone);
        if (phone) {
          const { data: user } = await sb
            .from('referral_users')
            .select('balance')
            .eq('phone', phone)
            .maybeSingle();
          if (user) {
            await sb
              .from('referral_users')
              .update({ balance: user.balance + applied })
              .eq('phone', phone);
          }
        }
      }
      return NextResponse.json(
        {
          error_code: 1,
          msg: stockResult.message,
          code: 'stock_unavailable',
        },
        { status: 503 }
      );
    }

    const { error } = await sb.from('orders').insert({
      id: body.orderId,
      data: body,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    // Attach referral dengan fraud scoring
    const refResult = await attachReferralToOrder(sb, body);

    if (!refResult.ok && refResult.reason === 'self_referral') {
      // Order sudah inserted — biarkan, tapi referral di-block.
    }

    // Track device customer untuk anti-fraud
    if (body.customer?.phone) {
      const customerPhone = normalizePhone(body.customer.phone);
      if (customerPhone) {
        await trackDevice(sb, {
          fingerprint: meta.fingerprint,
          phone: customerPhone,
          ip: meta.ip,
          user_agent: meta.user_agent,
          action: 'order',
        });
      }
    }

    await logAudit(sb, {
      phone: normalizePhone(body.customer?.phone) || null,
      action: 'order_create',
      result: 'success',
      detail: {
        order_id: body.orderId,
        total: body.total,
        ref_attached: refResult.attached,
        ref_score: refResult.score,
        ref_review: refResult.requires_review,
      },
      meta,
    });

    return NextResponse.json({
      error_code: 0,
      id: body.orderId,
      balance_applied: applied,
      referral: {
        attached: refResult.attached,
        requires_review: refResult.requires_review || false,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal menyimpan order' },
      { status: 500 }
    );
  }
}

// GET: admin ambil semua orders
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
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ error_code: 0, data: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal mengambil orders' },
      { status: 500 }
    );
  }
}
