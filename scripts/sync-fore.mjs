import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: brand, error: brandError } = await sb
  .from('brands')
  .select('id')
  .eq('code', 'fore-coffee')
  .single();
if (brandError) throw brandError;

const menuToken = await publicToken('https://fore.coffee/wp-json/wp/v2/pages/19556');
const outletToken = await publicToken('https://fore.coffee/wp-json/wp/v2/pages/17905');
const [menu, outlets] = await Promise.all([
  foreApi('https://api.fore.coffee/product/all_with_token', menuToken, { 'country-id': '1' }),
  foreApi('https://api.fore.coffee/store/all_with_token', outletToken),
]);

const categories = new Map();
for (const product of menu.payload || []) {
  const code = String(product.cat_id || product.cat_name);
  if (!categories.has(code)) {
    const { data, error } = await sb
      .from('catalog_categories')
      .upsert(
        {
          brand_id: brand.id,
          source_code: code,
          name: String(product.cat_name || 'Menu'),
          sort_order: Number(product.cat_order) || 0,
        },
        { onConflict: 'brand_id,source_code' }
      )
      .select()
      .single();
    if (error) throw error;
    categories.set(code, data);
  }
  const { data: saved, error } = await sb
    .from('catalog_products')
    .upsert(
      {
        brand_id: brand.id,
        source_product_id: String(product.pd_id),
        product_code: `FORE-${product.pd_id}`,
        name: String(product.pd_name || 'Produk'),
        description: String(product.pd_desc || ''),
        image_url: product.pd_img ? `https://static.fore.coffee/${product.pd_img}` : '',
        price: Number(product.pd_final_price) || 0,
        original_price: Number(product.pd_price_strikethrough) || Number(product.pd_final_price) || 0,
        is_promo: Number(product.pd_price_strikethrough) > Number(product.pd_final_price),
        is_sold_out: product.pd_status !== 'active',
        sort_order: Number(product.pd_order) || 0,
        source_payload: product,
      },
      { onConflict: 'brand_id,source_product_id' }
    )
    .select()
    .single();
  if (error) throw error;
  const { error: linkError } = await sb.from('catalog_product_categories').upsert(
    { category_id: categories.get(code).id, product_id: saved.id, sort_order: Number(product.pd_order) || 0 },
    { onConflict: 'category_id,product_id' }
  );
  if (linkError) throw linkError;
}

const outletRows = (outlets.payload || [])
  .filter((item) => Number(item.country_id) === 1 && item.is_visibility !== 'hide' && !Number(item.is_test || 0))
  .map((item) => ({
    brand_id: brand.id,
    source_id: String(item.st_id),
    code: String(item.st_code || `FORE-${item.st_id}`),
    name: String(item.st_name || '').trim(),
    country: 'ID',
    address: String(item.st_address || '').trim(),
    latitude: finiteOrNull(item.st_lat),
    longitude: finiteOrNull(item.st_long),
    opening_hours: [item.st_open, item.st_close].filter(Boolean).join('–'),
    is_open: !!item.is_open,
    image_url: item.sti_list?.[0]?.sti_img ? `https://static.fore.coffee/${item.sti_list[0].sti_img}` : '',
    tags: [item.st_concept_sanitize, item.st_default_type].filter(Boolean),
    source_payload: item,
  }));
for (let offset = 0; offset < outletRows.length; offset += 200) {
  const { error } = await sb
    .from('outlets')
    .upsert(outletRows.slice(offset, offset + 200), { onConflict: 'brand_id,source_id' });
  if (error) throw error;
}

console.log(`Fore Coffee: ${menu.payload?.length || 0} produk, ${outletRows.length} outlet.`);

async function publicToken(pageUrl) {
  const page = await fetch(pageUrl).then((response) => response.json());
  const blocks = [...String(page?.content?.rendered || '').matchAll(/\[vc_raw_html\]([A-Za-z0-9+/=]+)\[\/vc_raw_html\]/g)];
  for (const block of blocks) {
    let decoded = Buffer.from(block[1], 'base64').toString('utf8');
    try { decoded = decodeURIComponent(decoded); } catch (_) {}
    const token = decoded.match(/["']wp-token["']\s*:\s*["']([^"']+)["']/)?.[1];
    if (token) return token;
  }
  throw new Error('Token publik Fore tidak ditemukan.');
}

async function foreApi(endpoint, token, extra = {}) {
  const response = await fetch(endpoint, { headers: { 'wp-token': token, ...extra } });
  const body = await response.json();
  if (!response.ok || body.status !== 'success') throw new Error(`Sumber Fore gagal: ${endpoint}`);
  return body;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
