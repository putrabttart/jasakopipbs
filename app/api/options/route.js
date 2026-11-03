import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
  KK_API_BASE_URL,
  KK_HEADERS,
  KK_SIGNATURES,
  isKkApiConfigured,
} from '@/lib/kkHeaders';
import { KkApiError, parseKkResponse } from '@/lib/kkApi';

export const dynamic = 'force-dynamic';

const KK_URL = `${KK_API_BASE_URL}/product/get_product_options_v2`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const store_code = searchParams.get('store_code') || '';
  const product_id = Number(searchParams.get('product_id') || 0);
  const bundle_code = searchParams.get('bundle_code') || null;

  try {
    const sb = getSupabase();
    const { data: localProduct } = await sb
      .from('catalog_products')
      .select('*')
      .eq('id', product_id)
      .eq('is_active', true)
      .maybeSingle();
    if (localProduct) {
      return NextResponse.json({
        error_code: 0,
        data: {
          base_product: {
            id: localProduct.id,
            name: localProduct.name,
            description: localProduct.description,
            image: localProduct.image_url,
            price: localProduct.price,
          },
          option_product_map: {
            '': {
              product_code: localProduct.product_code,
              price: localProduct.price,
              display_description: '',
            },
          },
          product_dimension_wording: { dimension_wordings: [] },
          product_addon_wording: { addon_wordings: [] },
          notes: [],
          default_selection_impact_sku: {},
          default_selection_notes: {},
        },
      });
    }
  } catch (e) {
    console.error('Local product options error:', e.message);
  }

  if (!isKkApiConfigured(KK_SIGNATURES.options)) {
    return NextResponse.json(
      { error_code: 1, msg: 'Produk lokal tidak ditemukan.' },
      { status: 404 }
    );
  }

  const body = {
    store_code,
    product_id,
    version_v2: true,
    combo_bundle_code: null,
    combo_item_id: null,
    default_selected_sku: '',
    default_selected_addon_skus: [],
    default_selected_notes_map: {},
    replace_cart_item_ids: [],
    limit_to_size_code: 0,
    limit_to_temperature_code: 0,
    limit_to_skus: [],
    support_mandatory_topping: true,
    attribution_flag: null,
  };

  try {
    const res = await fetch(KK_URL, {
      method: 'POST',
      headers: { ...KK_HEADERS, clsignature: KK_SIGNATURES.options },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await parseKkResponse(res, 'Gagal mengambil opsi produk');
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal mengambil opsi produk' },
      { status: e instanceof KkApiError ? 502 : 500 }
    );
  }
}
