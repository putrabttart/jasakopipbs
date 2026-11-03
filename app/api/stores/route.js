import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { searchLocalOutlets, syncPublicOutlets } from '@/lib/outlets';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const brandCode = searchParams.get('brand') || 'kopi-kenangan';
  const pageIndex = Number(searchParams.get('page_index') || 1);
  const pageSize = Number(searchParams.get('page_size') || 20);

  try {
    const sb = getSupabase();
    let data = await searchLocalOutlets(sb, { query, pageIndex, pageSize, brandCode });
    if (data.total === 0) {
      const { count, error } = await sb
        .from('outlets')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', data.brand.id)
        .eq('country', 'ID');
      if (error) throw error;
      if (!count) {
        await syncPublicOutlets(sb, brandCode);
        data = await searchLocalOutlets(sb, { query, pageIndex, pageSize, brandCode });
      }
    }
    return NextResponse.json({ error_code: 0, msg: 'OK', data, source: 'local_outlets' });
  } catch (e) {
    console.error('Local outlets error:', e.message);
    return NextResponse.json(
      {
        error_code: 1,
        msg: /(relation .*outlets.* does not exist|table .*brands.*schema cache)/i.test(
          e.message || ''
        )
          ? 'Data outlet multi-brand belum siap. Jalankan migrasi 009 dan 010.'
          : e.message || 'Gagal mengambil data outlet lokal',
      },
      { status: 503 }
    );
  }
}
