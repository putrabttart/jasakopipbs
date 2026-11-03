import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.');
  process.exit(1);
}

const sourceUrl =
  'https://kenanganglobal.com/career/kk-hr-career/menu?country=ID&lang=id';
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: brand, error: brandError } = await sb
  .from('brands')
  .select('id')
  .eq('code', 'kopi-kenangan')
  .single();
if (brandError) throw brandError;
const response = await fetch(sourceUrl, { headers: { accept: 'application/json' } });
if (!response.ok) throw new Error(`Sumber publik gagal: HTTP ${response.status}`);
const payload = await response.json();
if (payload?.error_code !== 0 || !Array.isArray(payload?.data?.groups)) {
  throw new Error('Format sumber publik tidak valid.');
}

let links = 0;
for (const [categoryIndex, group] of payload.data.groups.entries()) {
  const { data: existingCategory } = await sb
    .from('catalog_categories')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('source_code', String(group.code))
    .maybeSingle();
  let category = existingCategory;
  let categoryError = null;
  if (!existingCategory?.manual_override) {
    const result = await sb
      .from('catalog_categories')
      .upsert(
        {
          brand_id: brand.id,
          source_code: String(group.code),
          name: String(group.name || 'Tanpa Kategori'),
          sort_order: categoryIndex,
          is_active: true,
        },
        { onConflict: 'brand_id,source_code' }
      )
      .select()
      .single();
    category = result.data;
    categoryError = result.error;
  }
  if (categoryError) throw categoryError;

  for (const [productIndex, product] of (group.products || []).entries()) {
    const { data: existing } = await sb
      .from('catalog_products')
      .select('*')
      .eq('brand_id', brand.id)
      .eq('source_product_id', String(product.id))
      .maybeSingle();
    const input = {
      source_product_id: String(product.id),
      brand_id: brand.id,
      product_code: String(product.code || `public-${product.id}`),
      bundle_code: product.bundle_code ? String(product.bundle_code) : null,
      name: String(product.name || 'Produk'),
      description: String(product.description || ''),
      image_url: String(product.image || ''),
      price: Math.max(0, Math.floor(Number(product.price) || 0)),
      original_price: Math.max(0, Math.floor(Number(product.orig_price) || 0)),
      is_promo: !!product.promo,
      is_combo: !!product.combo,
      is_sold_out: !!product.sold_out,
      is_active: true,
      labels: Array.isArray(product.labels) ? product.labels : [],
      sort_order: productIndex,
      source_payload: product,
    };
    const query = existing?.manual_override
      ? sb.from('catalog_products').select().eq('id', existing.id).single()
      : sb
          .from('catalog_products')
          .upsert(input, { onConflict: 'brand_id,source_product_id' })
          .select()
          .single();
    const { data: saved, error: productError } = await query;
    if (productError) throw productError;
    const { error: linkError } = await sb.from('catalog_product_categories').upsert(
      { category_id: category.id, product_id: saved.id, sort_order: productIndex },
      { onConflict: 'category_id,product_id' }
    );
    if (linkError) throw linkError;
    links++;
  }
}

await sb.from('settings').upsert(
  {
    key: 'catalog_sync',
    value: {
      source_url: sourceUrl,
      last_synced_at: new Date().toISOString(),
      source_updated_at: payload.data.updated_at || null,
      categories: payload.data.groups.length,
      product_links: links,
    },
  },
  { onConflict: 'key' }
);

console.log(`Sinkron selesai: ${payload.data.groups.length} kategori, ${links} relasi produk.`);
if (adminPassword) console.log('Katalog juga dapat dikelola melalui dashboard admin.');
