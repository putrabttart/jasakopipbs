import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEY = 'account_stock';
const DEFAULT = {
  count: 10,
  message: 'Mohon maaf, layanan sedang sibuk. Silakan coba lagi dalam beberapa saat ya.',
  auto_manage: true,
  enabled: true,
};

/**
 * GET /api/account-stock
 * - Public: hanya kembalikan { available, message } (tidak expose count!)
 * - Admin (dengan x-admin-password): kembalikan full config termasuk count
 */
export async function GET(request) {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    const value = { ...DEFAULT, ...(data?.value || {}) };
    const auth = request.headers.get('x-admin-password') || '';
    const isAdmin = auth && auth === process.env.ADMIN_PASSWORD;

    if (isAdmin) {
      return NextResponse.json({ error_code: 0, data: value });
    }

    // Public response: jangan beri tahu jumlah persisnya
    return NextResponse.json({
      error_code: 0,
      data: {
        available: !value.enabled ? true : value.count > 0,
        message: value.message,
      },
    });
  } catch (e) {
    return NextResponse.json({
      error_code: 0,
      data: { available: true, message: '' },
    });
  }
}

/**
 * POST /api/account-stock — admin update config
 */
export async function POST(request) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const value = {
      count: Math.max(0, Math.floor(Number(body.count) || 0)),
      message:
        typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : DEFAULT.message,
      auto_manage: body.auto_manage !== false,
      enabled: body.enabled !== false,
    };

    const sb = getSupabase();
    const { error } = await sb
      .from('settings')
      .upsert(
        { key: KEY, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) throw error;

    return NextResponse.json({ error_code: 0, data: value });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal simpan' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account-stock — admin manual adjust count (delta)
 * Body: { delta: number }
 */
export async function PATCH(request) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const delta = Math.floor(Number(body.delta) || 0);

    const sb = getSupabase();
    const { data: existing } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    const current = { ...DEFAULT, ...(existing?.value || {}) };
    current.count = Math.max(0, current.count + delta);

    const { error } = await sb
      .from('settings')
      .upsert(
        { key: KEY, value: current, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) throw error;

    return NextResponse.json({ error_code: 0, data: current });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal' },
      { status: 500 }
    );
  }
}
