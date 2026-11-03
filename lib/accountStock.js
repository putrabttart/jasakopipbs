/**
 * Helper untuk manage stok akun jasdor.
 * Stok di-decrement saat order dibuat, dikembalikan saat cancelled.
 * (Selesai/done = akun tetap dipakai, tidak dikembalikan)
 */

const KEY = 'account_stock';

export async function getStockConfig(sb) {
  try {
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    return {
      count: data?.value?.count ?? 10,
      message:
        data?.value?.message ||
        'Mohon maaf, layanan sedang sibuk. Silakan coba lagi dalam beberapa saat ya.',
      auto_manage: data?.value?.auto_manage !== false,
      enabled: data?.value?.enabled !== false,
    };
  } catch (_) {
    return {
      count: 999,
      message: 'Layanan sedang sibuk',
      auto_manage: false,
      enabled: false,
    };
  }
}

/**
 * Cek apakah masih ada stok. Kalau tidak ada, return {ok:false, message}
 */
export async function checkStockAvailable(sb) {
  const cfg = await getStockConfig(sb);
  if (!cfg.enabled) return { ok: true };
  if (cfg.count <= 0) {
    return { ok: false, message: cfg.message };
  }
  return { ok: true };
}

/**
 * Decrement stok by 1 secara atomic.
 * Return: { ok, message? }
 */
export async function decrementStock(sb) {
  try {
    const cfg = await getStockConfig(sb);
    if (!cfg.enabled || !cfg.auto_manage) return { ok: true };

    if (cfg.count <= 0) {
      return { ok: false, message: cfg.message };
    }

    const newCount = cfg.count - 1;
    const { error } = await sb
      .from('settings')
      .update({
        value: { ...cfg, count: newCount },
        updated_at: new Date().toISOString(),
      })
      .eq('key', KEY)
      .gte('value->count', 1); // atomic-ish guard

    if (error) {
      console.error('decrementStock error:', error.message);
      return { ok: false, message: cfg.message };
    }

    return { ok: true, remaining: newCount };
  } catch (e) {
    console.error('decrementStock catch:', e.message);
    return { ok: true }; // fail-open agar tidak block order karena error infra
  }
}

/**
 * Tambahkan kembali stok (saat order dibatalkan).
 */
export async function incrementStock(sb, amount = 1) {
  try {
    const cfg = await getStockConfig(sb);
    if (!cfg.enabled || !cfg.auto_manage) return;

    await sb
      .from('settings')
      .update({
        value: { ...cfg, count: cfg.count + amount },
        updated_at: new Date().toISOString(),
      })
      .eq('key', KEY);
  } catch (e) {
    console.error('incrementStock error:', e.message);
  }
}
