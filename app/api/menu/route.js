import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getCatalogMenu, syncPublicCatalog } from '@/lib/catalog';
import {
  KK_API_BASE_URL,
  KK_HEADERS,
  KK_SIGNATURES,
  isKkApiConfigured,
} from '@/lib/kkHeaders';
import { KkApiError, parseKkResponse } from '@/lib/kkApi';

export const dynamic = 'force-dynamic';

const KK_URL = `${KK_API_BASE_URL}/product/query_product_menu`;

export async function GET(request) {
  try {
    const sb = getSupabase();
    let data = await getCatalogMenu(sb);
    if (data.menu_groups.length === 0) {
      await syncPublicCatalog(sb);
      data = await getCatalogMenu(sb);
    }
    return NextResponse.json({ error_code: 0, data, source: 'local_catalog' });
  } catch (catalogError) {
    console.error('Local catalog error:', catalogError.message);
  }

  // Optional compatibility fallback while migrating an existing installation.
  if (!isKkApiConfigured(KK_SIGNATURES.menu)) {
    return NextResponse.json(
      {
        error_code: 1,
        msg: 'Katalog lokal belum siap. Jalankan migrasi 008_local_catalog.sql.',
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const store_code = searchParams.get('store_code') || '';

  const body = {
    store_code,
    voucher_code: null,
    product_without_promo: true,
    display_combo_v2: true,
    display_merchandise_product: true,
    display_mix_match_optional: true,
    support_discount_percentage: true,
  };

  try {
    const res = await fetch(KK_URL, {
      method: 'POST',
      headers: { ...KK_HEADERS, clsignature: KK_SIGNATURES.menu },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await parseKkResponse(res, 'Gagal mengambil menu');
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal mengambil menu' },
      { status: e instanceof KkApiError ? 502 : 500 }
    );
  }
}
