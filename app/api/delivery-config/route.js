import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEY = 'delivery_config';

const DEFAULT = {
  enabled: false,
  fee: 10000,
  outlets: [], // array of store_code
};

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    const v = data?.value || {};
    return NextResponse.json({
      error_code: 0,
      data: {
        enabled: !!v.enabled,
        fee: Number(v.fee) || DEFAULT.fee,
        outlets: Array.isArray(v.outlets) ? v.outlets : [],
      },
    });
  } catch (e) {
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
      enabled: !!body.enabled,
      fee: Math.max(0, Math.floor(Number(body.fee) || 0)),
      outlets: Array.isArray(body.outlets)
        ? body.outlets.filter((s) => typeof s === 'string' && s.length > 0)
        : [],
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
      { error_code: 1, msg: e.message || 'Gagal update' },
      { status: 500 }
    );
  }
}
