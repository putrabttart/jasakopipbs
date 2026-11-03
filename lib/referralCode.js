/**
 * Generate kode referral pendek dari nama depan + 2 angka.
 * cth: "Iqbal Pratama" → "IQBAL47"
 *      "Andi" → "ANDI23"
 *      "" → "USER91" (fallback)
 */
export function generateReferralCodeFromName(name = '') {
  // Ambil nama depan saja (kata pertama)
  const firstWord = String(name).trim().split(/\s+/)[0] || '';

  // Hapus karakter non-alfabet, uppercase, max 6 char
  let prefix = firstWord.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6);

  // Fallback kalau kosong / terlalu pendek
  if (prefix.length < 3) prefix = (prefix + 'USER').slice(0, 4);

  // 2 angka random (10-99)
  const num = Math.floor(Math.random() * 90) + 10;
  return `${prefix}${num}`;
}

/**
 * Legacy: kode random pendek (fallback kalau benar-benar gagal generate dari nama).
 */
export function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  const num = Math.floor(Math.random() * 90) + 10;
  return `${code}${num}`;
}
