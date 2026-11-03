import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { searchLocalOutlets, syncPublicOutlets } from '@/lib/outlets';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const pageIndex = Number(searchParams.get('page_index') || 1);
  const pageSize = Number(searchParams.get('page_size') || 20);

  try {
    const sb = getSupabase();
    let data = await searchLocalOutlets(sb, { query, pageIndex, pageSize });
    if (data.total === 0) {
      const { count, error } = await sb
        .from('outlets')
        .select('id', { count: 'exact', head: true })
        .eq('country', 'ID');
      if (error) throw error;
      if (!count) {
        await syncPublicOutlets(sb);
        data = await searchLocalOutlets(sb, { query, pageIndex, pageSize });
      }
    }
    return NextResponse.json({ error_code: 0, msg: 'OK', data, source: 'local_outlets' });
  } catch (e) {
    console.error('Local outlets error:', e.message);
    return NextResponse.json(
      {
        error_code: 1,
        msg: /relation .*outlets.* does not exist/i.test(e.message || '')
          ? 'Data outlet lokal belum siap. Jalankan migrasi 009_local_outlets.sql.'
          : e.message || 'Gagal mengambil data outlet lokal',
      },
      { status: 503 }
    );
  }
}
