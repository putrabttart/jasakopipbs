import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEY = 'service_open';

export async function GET() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('settings')
      .select('value, updated_at')
      .eq('key', KEY)
      .maybeSingle();

    if (error) {
      console.error('service-status GET error:', error.message);
      throw error;
    }

    return NextResponse.json({
      error_code: 0,
      data: {
        open: data?.value?.open ?? true,
        message: data?.value?.message || '',
        updated_at: data?.updated_at || null,
      },
    });
  } catch (e) {
    console.error('service-status fallback:', e.message);
    // Default = buka (failsafe)
    return NextResponse.json({
      error_code: 0,
      data: { open: true, message: '', updated_at: null },
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
    const value = {
      open: !!body.open,
      message: typeof body.message === 'string' ? body.message : '',
    };

    const sb = getSupabase();
    const { error } = await sb
      .from('settings')
      .upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      console.error('service-status POST error:', error.message);
      return NextResponse.json(
        { error_code: 1, msg: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error_code: 0, data: value });
  } catch (e) {
    console.error('service-status POST catch:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal update status' },
      { status: 500 }
    );
  }
}
