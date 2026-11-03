const PUBLIC_MENU_URL =
  'https://kenanganglobal.com/career/kk-hr-career/menu?country=ID&lang=id';
import { fetchForeMenu } from './fore';

export async function getCatalogMenu(
  sb,
  { includeInactive = false, brandCode = 'kopi-kenangan' } = {}
) {
  const brand = await getBrand(sb, brandCode);
  let categoryQuery = sb
    .from('catalog_categories')
    .select('*')
    .eq('brand_id', brand.id)
    .order('sort_order')
    .order('id');
  let productQuery = sb
    .from('catalog_products')
    .select('*')
    .eq('brand_id', brand.id)
    .order('sort_order')
    .order('id');

  if (!includeInactive) {
    categoryQuery = categoryQuery.eq('is_active', true);
    productQuery = productQuery.eq('is_active', true);
  }

  const [{ data: categories, error: catError }, { data: products, error: productError }] =
    await Promise.all([categoryQuery, productQuery]);
  if (catError) throw catError;
  if (productError) throw productError;

  const categoryIds = (categories || []).map((category) => category.id);
  const { data: links, error: linkError } = categoryIds.length
    ? await sb
        .from('catalog_product_categories')
        .select('*')
        .in('category_id', categoryIds)
        .order('sort_order')
    : { data: [], error: null };
  if (linkError) throw linkError;

  const productMap = new Map((products || []).map((product) => [product.id, product]));
  const linksByCategory = new Map();
  for (const link of links || []) {
    const product = productMap.get(link.product_id);
    if (!product) continue;
    const list = linksByCategory.get(link.category_id) || [];
    list.push({ ...product, category_sort_order: link.sort_order });
    linksByCategory.set(link.category_id, list);
  }

  return {
    brand: { id: brand.id, code: brand.code, name: brand.name, logo_url: brand.logo_url },
    menu_groups: (categories || []).map((category) => ({
      group_code: category.source_code || `local-${category.id}`,
      group_name: category.name,
      local_id: category.id,
      is_active: category.is_active,
      manual_override: category.manual_override,
      sort_order: category.sort_order,
      menu_products: (linksByCategory.get(category.id) || []).map(formatProduct),
    })),
  };
}

export async function syncPublicCatalog(sb, brandCode = 'kopi-kenangan') {
  const brand = await getBrand(sb, brandCode);
  const source =
    brandCode === 'fore-coffee' ? await fetchForeMenu() : await fetchKopiKenanganMenu();

  const [{ data: existingCategories }, { data: existingProducts }] = await Promise.all([
    sb.from('catalog_categories').select('*').eq('brand_id', brand.id),
    sb.from('catalog_products').select('*').eq('brand_id', brand.id),
  ]);
  const categoryMap = new Map((existingCategories || []).map((row) => [row.source_code, row]));
  const productMap = new Map(
    (existingProducts || []).map((row) => [String(row.source_product_id), row])
  );

  let productCount = 0;
  for (const [categoryIndex, group] of source.groups.entries()) {
    const existingCategory = categoryMap.get(String(group.code));
    const categoryInput = existingCategory?.manual_override
      ? { ...existingCategory }
      : {
          source_code: String(group.code),
          brand_id: brand.id,
          name: String(group.name || 'Tanpa Kategori'),
          sort_order: categoryIndex,
          is_active: true,
        };
    delete categoryInput.id;
    delete categoryInput.created_at;
    delete categoryInput.updated_at;

    const { data: category, error: categoryError } = await sb
      .from('catalog_categories')
      .upsert(categoryInput, { onConflict: 'brand_id,source_code' })
      .select()
      .single();
    if (categoryError) throw categoryError;

    for (const [productIndex, product] of (group.products || []).entries()) {
      const sourceId = String(product.id);
      const existingProduct = productMap.get(sourceId);
      const imported = {
        source_product_id: sourceId,
        brand_id: brand.id,
        product_code: String(product.code || `public-${sourceId}`),
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
        sort_order: Number(product.order) || productIndex,
        source_payload: product.raw || product,
      };
      const productInput = existingProduct?.manual_override
        ? {
            ...imported,
            name: existingProduct.name,
            description: existingProduct.description,
            image_url: existingProduct.image_url,
            price: existingProduct.price,
            original_price: existingProduct.original_price,
            is_sold_out: existingProduct.is_sold_out,
            is_active: existingProduct.is_active,
            manual_override: true,
          }
        : imported;

      const { data: savedProduct, error: productError } = await sb
        .from('catalog_products')
        .upsert(productInput, { onConflict: 'brand_id,source_product_id' })
        .select()
        .single();
      if (productError) throw productError;

      const { error: linkError } = await sb.from('catalog_product_categories').upsert(
        {
          category_id: category.id,
          product_id: savedProduct.id,
          sort_order: productIndex,
        },
        { onConflict: 'category_id,product_id' }
      );
      if (linkError) throw linkError;
      productCount++;
    }
  }

  const syncInfo = {
    brand: brandCode,
    source_url: source.source_url,
    last_synced_at: new Date().toISOString(),
    source_updated_at: source.updated_at || null,
    categories: source.groups.length,
    product_links: productCount,
  };
  const { error: settingsError } = await sb.from('settings').upsert(
    {
      key: brandCode === 'kopi-kenangan' ? 'catalog_sync' : `catalog_sync_${brandCode}`,
      value: syncInfo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (settingsError) throw settingsError;
  return syncInfo;
}

export async function getCatalogSyncInfo(sb, brandCode = 'kopi-kenangan') {
  const { data } = await sb
    .from('settings')
    .select('value')
    .eq('key', brandCode === 'kopi-kenangan' ? 'catalog_sync' : `catalog_sync_${brandCode}`)
    .maybeSingle();
  return data?.value || { source_url: PUBLIC_MENU_URL, last_synced_at: null };
}

async function fetchKopiKenanganMenu() {
  const response = await fetch(PUBLIC_MENU_URL, {
    headers: { accept: 'application/json', 'user-agent': 'JasdorAja/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Sumber menu publik gagal (HTTP ${response.status})`);
  const payload = await response.json();
  if (payload?.error_code !== 0 || !Array.isArray(payload?.data?.groups)) {
    throw new Error(payload?.msg || 'Format sumber menu publik tidak valid');
  }
  return {
    groups: payload.data.groups,
    source_url: PUBLIC_MENU_URL,
    updated_at: payload.data.updated_at || null,
  };
}

async function getBrand(sb, code) {
  const { data, error } = await sb.from('brands').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Brand ${code} belum tersedia. Jalankan migrasi 010.`);
  return data;
}

function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image_url,
    price: product.price,
    orig_price: product.original_price,
    product_code: product.product_code,
    bundle_code: product.bundle_code || '',
    is_sold_out: product.is_sold_out,
    is_combo_v2: product.is_combo,
    is_mix_match: false,
    type_code: 0,
    labels: product.labels || [],
    local_catalog: true,
    is_active: product.is_active,
    manual_override: product.manual_override,
    sort_order: product.sort_order,
    image_url: product.image_url,
  };
}
