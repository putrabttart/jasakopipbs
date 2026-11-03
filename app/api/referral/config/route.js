import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const KEY = 'referral_config';
const DEFAULT = { reward: 2000, min_withdraw: 10000, enabled: true };

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    return NextResponse.json({
      error_code: 0,
      data: { ...DEFAULT, ...(data?.value || {}) },
    });
  } catch (_) {
    return NextResponse.json({ error_code: 0, data: DEFAULT });
  }
}

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
      reward: Math.max(0, Math.floor(Number(body.reward) || 0)),
      min_withdraw: Math.max(0, Math.floor(Number(body.min_withdraw) || 0)),
      enabled: !!body.enabled,
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
      { error_code: 1, msg: e.message || 'Gagal simpan config' },
      { status: 500 }
    );
  }
}
