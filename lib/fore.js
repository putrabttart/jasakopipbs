const FORE_MENU_PAGE_API = 'https://fore.coffee/wp-json/wp/v2/pages/19556';
const FORE_OUTLET_PAGE_API = 'https://fore.coffee/wp-json/wp/v2/pages/17905';
const FORE_MENU_API = 'https://api.fore.coffee/product/all_with_token';
const FORE_OUTLET_API = 'https://api.fore.coffee/store/all_with_token';

export async function fetchForeMenu() {
  const token = await extractPublicToken(FORE_MENU_PAGE_API, 'all_with_token');
  const payload = await fetchForeApi(FORE_MENU_API, token, { 'country-id': '1' });
  const products = Array.isArray(payload?.payload) ? payload.payload : [];
  const groups = new Map();

  for (const product of products) {
    const code = String(product.cat_id || product.cat_name || 'fore-menu');
    if (!groups.has(code)) {
      groups.set(code, {
        code,
        name: String(product.cat_name || 'Menu'),
        order: Number(product.cat_order) || 0,
        products: [],
      });
    }
    groups.get(code).products.push({
      id: String(product.pd_id),
      code: `FORE-${product.pd_id}`,
      bundle_code: null,
      name: String(product.pd_name || 'Produk'),
      description: String(product.pd_desc || ''),
      image: product.pd_img ? `https://static.fore.coffee/${product.pd_img}` : '',
      price: Number(product.pd_final_price) || 0,
      orig_price: Number(product.pd_price_strikethrough) || Number(product.pd_final_price) || 0,
      promo: Number(product.pd_price_strikethrough) > Number(product.pd_final_price),
      combo: false,
      sold_out: product.pd_status !== 'active',
      labels: [],
      order: Number(product.pd_order) || 0,
      raw: product,
    });
  }

  return {
    groups: [...groups.values()].sort((a, b) => a.order - b.order),
    source_url: 'https://fore.coffee/id/menu-indo/',
  };
}

export async function fetchForeOutlets() {
  const token = await extractPublicToken(FORE_OUTLET_PAGE_API, 'all_with_token');
  const payload = await fetchForeApi(FORE_OUTLET_API, token);
  const rows = Array.isArray(payload?.payload) ? payload.payload : [];
  return {
    outlets: rows
      .filter(
        (outlet) =>
          Number(outlet.country_id) === 1 &&
          outlet.is_visibility !== 'hide' &&
          Number(outlet.is_test || 0) === 0
      )
      .map((outlet) => ({
        id: String(outlet.st_id),
        code: String(outlet.st_code || `FORE-${outlet.st_id}`),
        name: String(outlet.st_name || '').trim(),
        country: 'ID',
        city: '',
        addr: String(outlet.st_address || '').trim(),
        hours: [outlet.st_open, outlet.st_close].filter(Boolean).join('–'),
        open: !!outlet.is_open,
        lat: outlet.st_lat,
        lng: outlet.st_long,
        tags: [outlet.st_concept_sanitize, outlet.st_default_type].filter(Boolean),
        image: outlet.sti_list?.[0]?.sti_img
          ? `https://static.fore.coffee/${outlet.sti_list[0].sti_img}`
          : '',
        raw: outlet,
      })),
    source_url: 'https://fore.coffee/store/',
  };
}

async function extractPublicToken(pageApiUrl, endpointMarker) {
  const response = await fetch(pageApiUrl, {
    headers: { accept: 'application/json', 'user-agent': 'JasdorAja/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Halaman publik Fore gagal (HTTP ${response.status})`);
  const page = await response.json();
  const content = String(page?.content?.rendered || '');
  const blocks = [...content.matchAll(/\[vc_raw_html\]([A-Za-z0-9+/=]+)\[\/vc_raw_html\]/g)];

  for (const block of blocks) {
    let decoded = Buffer.from(block[1], 'base64').toString('utf8');
    try {
      decoded = decodeURIComponent(decoded);
    } catch (_) {}
    if (!decoded.includes(endpointMarker)) continue;
    const token = decoded.match(/["']wp-token["']\s*:\s*["']([^"']+)["']/)?.[1];
    if (token) return token;
  }
  throw new Error('Token publik Fore tidak ditemukan pada halaman resmi.');
}

async function fetchForeApi(url, token, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'wp-token': token,
      ...extraHeaders,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== 'success') {
    throw new Error(payload?.payload?.errors?.[0]?.text || `Sumber Fore gagal (HTTP ${response.status})`);
  }
  return payload;
}
