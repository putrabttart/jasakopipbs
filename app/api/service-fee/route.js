import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEY = 'service_fee';
const DEFAULT_FEE = 7000;

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
      data: { fee: data?.value?.fee ?? DEFAULT_FEE },
    });
  } catch (e) {
    return NextResponse.json({
      error_code: 0,
      data: { fee: DEFAULT_FEE },
    });
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
    const fee = Math.max(0, Math.floor(Number(body.fee) || 0));

    const sb = getSupabase();
    const { error } = await sb
      .from('settings')
      .upsert(
        { key: KEY, value: { fee }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) throw error;

    return NextResponse.json({ error_code: 0, data: { fee } });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal update fee' },
      { status: 500 }
    );
  }
}
