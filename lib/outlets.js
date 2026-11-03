export const PUBLIC_OUTLETS_URL =
  'https://kenanganglobal.com/career/kk-hr-career/outlets';
import { fetchForeOutlets } from './fore';

export async function searchLocalOutlets(
  sb,
  { query = '', pageIndex = 1, pageSize = 20, brandCode = 'kopi-kenangan' } = {}
) {
  const brand = await getBrand(sb, brandCode);
  const safePage = Math.max(1, Math.floor(Number(pageIndex) || 1));
  const safeSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 20)));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  let request = sb
    .from('outlets')
    .select('*', { count: 'exact' })
    .eq('brand_id', brand.id)
    .eq('country', 'ID')
    .eq('is_active', true)
    .order('name')
    .range(from, to);

  const term = String(query || '').trim().replace(/[%_,()]/g, ' ');
  if (term) {
    request = request.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const { data, count, error } = await request;
  if (error) throw error;
  const total = count || 0;
  return {
    brand: { id: brand.id, code: brand.code, name: brand.name, logo_url: brand.logo_url },
    store: (data || []).map((outlet) => formatOutlet(outlet, brand)),
    page_index: safePage,
    page_size: safeSize,
    pages: Math.max(1, Math.ceil(total / safeSize)),
    total,
  };
}

export async function syncPublicOutlets(sb, brandCode = 'kopi-kenangan') {
  const brand = await getBrand(sb, brandCode);
  const source =
    brandCode === 'fore-coffee' ? await fetchForeOutlets() : await fetchKopiKenanganOutlets();
  const sourceOutlets = source.outlets;
  const { data: existing, error: existingError } = await sb
    .from('outlets')
    .select('*')
    .eq('brand_id', brand.id)
    .eq('country', 'ID');
  if (existingError) throw existingError;
  const existingMap = new Map((existing || []).map((row) => [row.source_id, row]));

  const batchSize = 200;
  for (let offset = 0; offset < sourceOutlets.length; offset += batchSize) {
    const rows = sourceOutlets.slice(offset, offset + batchSize).map((outlet) => {
      const current = existingMap.get(String(outlet.id));
      const imported = {
        source_id: String(outlet.id),
        brand_id: brand.id,
        code: String(outlet.id),
        name: String(outlet.name || '').trim(),
        country: 'ID',
        city: String(outlet.city || '').trim(),
        address: String(outlet.addr || '').trim(),
        latitude: finiteOrNull(outlet.lat),
        longitude: finiteOrNull(outlet.lng),
        opening_hours: String(outlet.hours || ''),
        is_open: !!outlet.open,
        image_url: String(outlet.image || ''),
        tags: Array.isArray(outlet.tags) ? outlet.tags : [],
        is_active: true,
        source_payload: outlet,
      };
      if (!current?.manual_override) return imported;
      return {
        ...imported,
        name: current.name,
        city: current.city,
        address: current.address,
        latitude: current.latitude,
        longitude: current.longitude,
        opening_hours: current.opening_hours,
        is_open: current.is_open,
        image_url: current.image_url,
        is_active: current.is_active,
        manual_override: true,
      };
    });
    const { error } = await sb
      .from('outlets')
      .upsert(rows, { onConflict: 'brand_id,source_id' });
    if (error) throw error;
  }

  const sourceIds = new Set(sourceOutlets.map((outlet) => String(outlet.id)));
  const removedIds = (existing || [])
    .filter((row) => !row.manual_override && !sourceIds.has(row.source_id))
    .map((row) => row.id);
  if (removedIds.length) {
    const { error } = await sb.from('outlets').update({ is_active: false }).in('id', removedIds);
    if (error) throw error;
  }

  const info = {
    brand: brandCode,
    source_url: source.source_url,
    last_synced_at: new Date().toISOString(),
    source_updated_at: source.updated_at || null,
    outlets: sourceOutlets.length,
  };
  const { error: settingsError } = await sb.from('settings').upsert(
    {
      key: brandCode === 'kopi-kenangan' ? 'outlet_sync' : `outlet_sync_${brandCode}`,
      value: info,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (settingsError) throw settingsError;
  return info;
}

export async function getOutletSyncInfo(sb, brandCode = 'kopi-kenangan') {
  const { data } = await sb
    .from('settings')
    .select('value')
    .eq('key', brandCode === 'kopi-kenangan' ? 'outlet_sync' : `outlet_sync_${brandCode}`)
    .maybeSingle();
  return data?.value || { source_url: PUBLIC_OUTLETS_URL, last_synced_at: null };
}

async function fetchKopiKenanganOutlets() {
  const response = await fetch(PUBLIC_OUTLETS_URL, {
    headers: { accept: 'application/json', 'user-agent': 'JasdorAja/1.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Sumber outlet publik gagal (HTTP ${response.status})`);
  const payload = await response.json();
  if (payload?.error_code !== 0 || !Array.isArray(payload?.data?.outlets)) {
    throw new Error(payload?.msg || 'Format sumber outlet publik tidak valid');
  }
  return {
    outlets: payload.data.outlets.filter((outlet) => outlet.country === 'ID'),
    source_url: PUBLIC_OUTLETS_URL,
    updated_at: payload.data.updated_at || null,
  };
}

async function getBrand(sb, code) {
  const { data, error } = await sb.from('brands').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Brand ${code} belum tersedia. Jalankan migrasi 010.`);
  return data;
}

function formatOutlet(outlet, brand) {
  const [open = '', close = ''] = outlet.opening_hours.split(/[–-]/).map((value) => value.trim());
  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,
    address: outlet.address,
    city: outlet.city,
    latitude: outlet.latitude,
    longitude: outlet.longitude,
    open,
    close,
    is_open: outlet.is_open,
    image_url: outlet.image_url,
    tags: outlet.tags || [],
    local_outlet: true,
    opening_hours: outlet.opening_hours,
    is_active: outlet.is_active,
    manual_override: outlet.manual_override,
    brand_code: brand.code,
    brand_name: brand.name,
    brand_logo_url: brand.logo_url,
  };
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
