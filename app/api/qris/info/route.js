import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
      .from('settings')
      .select('*')
      .eq('key', 'qris_static');

    console.log('QRIS info GET — error:', error, 'data:', data);

    if (error) throw error;

    const row = data?.[0];
    return NextResponse.json({
      error_code: 0,
      data: row?.value || null,
    });
  } catch (e) {
    console.error('QRIS info GET catch:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal load QRIS' },
      { status: 500 }
    );
  }
}
