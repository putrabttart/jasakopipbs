import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getOutletSyncInfo, searchLocalOutlets, syncPublicOutlets } from '@/lib/outlets';

export const dynamic = 'force-dynamic';

function authorized(request) {
  return (request.headers.get('x-admin-password') || '') === process.env.ADMIN_PASSWORD;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error_code: 1, msg: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const sb = getSupabase();
    const [outlets, sync] = await Promise.all([
      searchLocalOutlets(sb, {
        query: searchParams.get('query') || '',
        pageIndex: searchParams.get('page_index') || 1,
        pageSize: searchParams.get('page_size') || 50,
      }),
      getOutletSyncInfo(sb),
    ]);
    return NextResponse.json({ error_code: 0, data: { ...outlets, sync } });
  } catch (e) {
    return NextResponse.json({ error_code: 1, msg: e.message || 'Gagal memuat outlet' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error_code: 1, msg: 'Unauthorized' }, { status: 401 });
  }
  try {
    const info = await syncPublicOutlets(getSupabase());
    return NextResponse.json({ error_code: 0, data: info });
  } catch (e) {
    return NextResponse.json({ error_code: 1, msg: e.message || 'Gagal sinkronisasi outlet' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error_code: 1, msg: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const update = { manual_override: true };
    for (const field of ['name', 'city', 'address', 'opening_hours', 'image_url']) {
      if (typeof body[field] === 'string') update[field] = body[field].trim();
    }
    for (const field of ['latitude', 'longitude']) {
      if (body[field] === null || Number.isFinite(Number(body[field]))) {
        update[field] = body[field] === null || body[field] === '' ? null : Number(body[field]);
      }
    }
    if (typeof body.is_open === 'boolean') update.is_open = body.is_open;
    if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
    const { error } = await getSupabase().from('outlets').update(update).eq('id', body.id);
    if (error) throw error;
    return NextResponse.json({ error_code: 0 });
  } catch (e) {
    return NextResponse.json({ error_code: 1, msg: e.message || 'Gagal memperbarui outlet' }, { status: 500 });
  }
}
