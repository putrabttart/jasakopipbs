import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.');
  process.exit(1);
}

const sourceUrl = 'https://kenanganglobal.com/career/kk-hr-career/outlets';
const response = await fetch(sourceUrl, { headers: { accept: 'application/json' } });
if (!response.ok) throw new Error(`Sumber outlet publik gagal: HTTP ${response.status}`);
const payload = await response.json();
if (payload?.error_code !== 0 || !Array.isArray(payload?.data?.outlets)) {
  throw new Error('Format sumber outlet publik tidak valid.');
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const sourceOutlets = payload.data.outlets.filter((outlet) => outlet.country === 'ID');
const { data: existing, error: existingError } = await sb
  .from('outlets')
  .select('*')
  .eq('country', 'ID');
if (existingError) throw existingError;
const existingMap = new Map((existing || []).map((row) => [row.source_id, row]));

for (let offset = 0; offset < sourceOutlets.length; offset += 200) {
  const rows = sourceOutlets.slice(offset, offset + 200).map((outlet) => {
    const current = existingMap.get(String(outlet.id));
    const imported = {
      source_id: String(outlet.id),
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
  const { error } = await sb.from('outlets').upsert(rows, { onConflict: 'source_id' });
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

await sb.from('settings').upsert(
  {
    key: 'outlet_sync',
    value: {
      source_url: sourceUrl,
      last_synced_at: new Date().toISOString(),
      source_updated_at: payload.data.updated_at || null,
      outlets: sourceOutlets.length,
    },
  },
  { onConflict: 'key' }
);
console.log(`Sinkron selesai: ${sourceOutlets.length} outlet Indonesia.`);

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
