import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEY = 'payment_timeout';
const DEFAULT_MIN = 30;

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();
    const minutes = parseInt(data?.value?.minutes, 10);
    return NextResponse.json({
      error_code: 0,
      data: { minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_MIN },
    });
  } catch (_) {
    return NextResponse.json({ error_code: 0, data: { minutes: DEFAULT_MIN } });
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
    const minutes = Math.max(5, Math.floor(Number(body.minutes) || DEFAULT_MIN));
    const sb = getSupabase();
    await sb
      .from('settings')
      .upsert(
        { key: KEY, value: { minutes }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    return NextResponse.json({ error_code: 0, data: { minutes } });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Failed' },
      { status: 500 }
    );
  }
}
