/**
 * Normalisasi nomor telepon Indonesia ke format 62xxx (tanpa + atau 0)
 * Output: string angka saja, atau '' kalau invalid
 */
export function normalizePhone(input) {
  if (!input) return '';
  let p = String(input).replace(/[^0-9]/g, '');
  if (!p) return '';
  if (p.startsWith('62')) return p;
  if (p.startsWith('0')) return '62' + p.slice(1);
  if (p.startsWith('8')) return '62' + p;
  return p;
}

export function isValidPhone(input) {
  const p = normalizePhone(input);
  return /^62[0-9]{8,13}$/.test(p);
}

/**
 * Format display: 0812-3456-7890
 */
export function formatPhone(input) {
  const p = normalizePhone(input);
  if (!p) return '';
  const local = '0' + p.slice(2);
  return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}
