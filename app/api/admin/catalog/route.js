import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getCatalogMenu, getCatalogSyncInfo, syncPublicCatalog } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

function authorized(request) {
  return (request.headers.get('x-admin-password') || '') === process.env.ADMIN_PASSWORD;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error_code: 1, msg: 'Unauthorized' }, { status: 401 });
  }
  try {
    const sb = getSupabase();
    const { searchParams } = new URL(request.url);
    const brandCode = searchParams.get('brand') || 'kopi-kenangan';
    const [catalog, sync] = await Promise.all([
      getCatalogMenu(sb, { includeInactive: true, brandCode }),
      getCatalogSyncInfo(sb, brandCode),
    ]);
    return NextResponse.json({ error_code: 0, data: { ...catalog, sync } });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal memuat katalog' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error_code: 1, msg: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const info = await syncPublicCatalog(getSupabase(), body.brand || 'kopi-kenangan');
    return NextResponse.json({ error_code: 0, data: info });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal sinkronisasi katalog' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error_code: 1, msg: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const sb = getSupabase();
    if (body.entity === 'category') {
      const update = { manual_override: true };
      if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
      if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
      if (Number.isFinite(Number(body.sort_order))) update.sort_order = Number(body.sort_order);
      const { error } = await sb.from('catalog_categories').update(update).eq('id', body.id);
      if (error) throw error;
    } else if (body.entity === 'product') {
      const update = { manual_override: true };
      if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
      if (typeof body.description === 'string') update.description = body.description.trim();
      if (typeof body.image_url === 'string') update.image_url = body.image_url.trim();
      if (Number.isFinite(Number(body.price))) update.price = Math.max(0, Math.floor(Number(body.price)));
      if (Number.isFinite(Number(body.original_price))) {
        update.original_price = Math.max(0, Math.floor(Number(body.original_price)));
      }
      if (typeof body.is_sold_out === 'boolean') update.is_sold_out = body.is_sold_out;
      if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
      if (Number.isFinite(Number(body.sort_order))) update.sort_order = Number(body.sort_order);
      const { error } = await sb.from('catalog_products').update(update).eq('id', body.id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error_code: 1, msg: 'Entity tidak valid' }, { status: 400 });
    }
    return NextResponse.json({ error_code: 0 });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal memperbarui katalog' },
      { status: 500 }
    );
  }
}
