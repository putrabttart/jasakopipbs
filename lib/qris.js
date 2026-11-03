/**
 * QRIS Parser & Converter
 * Mengikuti spesifikasi EMVCo QR Code TLV encoding.
 *
 * Flow: Static QRIS → parse TLV → ubah tag 01 (11→12) → insert tag 54 (amount)
 *       → optional fee tags → recalculate CRC16 → Dynamic QRIS string
 */

// Parse TLV dari string QRIS
export function parseTLV(data) {
  const elements = [];
  let i = 0;
  while (i < data.length) {
    if (i + 4 > data.length) break;
    const tag = data.substring(i, i + 2);
    const length = parseInt(data.substring(i + 2, i + 4), 10);
    if (isNaN(length)) break;
    const value = data.substring(i + 4, i + 4 + length);
    elements.push({ tag, length, value });
    i += 4 + length;
  }
  return elements;
}

// Parse QRIS string ke objek terstruktur
export function parseQRIS(qrisString) {
  const elements = parseTLV(qrisString);
  const get = (tag) => elements.find((e) => e.tag === tag)?.value || '';

  const method = get('01') === '12' ? 'dynamic' : 'static';

  // Merchant account info (tags 26-51)
  const merchantAccountInfo = elements
    .filter((e) => {
      const t = parseInt(e.tag, 10);
      return t >= 26 && t <= 51;
    })
    .map((e) => ({
      tag: e.tag,
      value: e.value,
      sub: parseTLV(e.value),
    }));

  return {
    version: get('00'),
    method,
    merchantName: get('59'),
    merchantCity: get('60'),
    merchantCategoryCode: get('52'),
    currency: get('53'),
    amount: get('54') || null,
    merchantAccountInfo,
    rawTLV: elements,
  };
}

// Validate QRIS string
export function validateQRIS(qrisString) {
  const errors = [];

  if (!qrisString || qrisString.length < 20) {
    errors.push('String QRIS terlalu pendek');
    return { valid: false, errors };
  }

  // Check CRC (last 4 chars after tag 63 + 04)
  const crcTag = qrisString.substring(qrisString.length - 8, qrisString.length - 4);
  if (crcTag !== '6304') {
    errors.push('Tag CRC (6304) tidak ditemukan di posisi yang benar');
    return { valid: false, errors };
  }

  const payload = qrisString.substring(0, qrisString.length - 4);
  const expectedCRC = crc16(payload).toUpperCase();
  const actualCRC = qrisString.substring(qrisString.length - 4).toUpperCase();

  if (expectedCRC !== actualCRC) {
    errors.push(`CRC mismatch: expected ${expectedCRC}, got ${actualCRC}`);
  }

  // Check version
  if (!qrisString.startsWith('000201')) {
    errors.push('Payload format indicator tidak valid');
  }

  return { valid: errors.length === 0, errors };
}

// Convert static QRIS ke dynamic dengan amount
export function convertQRIS(qrisString, options = {}) {
  const { amount, fee } = options;
  let elements = parseTLV(qrisString);

  // 1. Change tag 01: 11 → 12 (static → dynamic)
  elements = elements.map((e) => {
    if (e.tag === '01') {
      return { ...e, value: '12', length: 2 };
    }
    return e;
  });

  // 2. Remove existing amount/fee/CRC tags
  elements = elements.filter(
    (e) => !['54', '55', '56', '57', '63'].includes(e.tag)
  );

  // 3. Insert amount (tag 54) if provided
  if (amount != null && amount > 0) {
    const amountStr = String(amount);
    elements.push({ tag: '54', length: amountStr.length, value: amountStr });
  }

  // 4. Insert fee if provided
  if (fee) {
    if (fee.type === 'fixed' && fee.value > 0) {
      elements.push({ tag: '55', length: 2, value: '02' }); // fixed indicator
      const feeStr = String(fee.value);
      elements.push({ tag: '56', length: feeStr.length, value: feeStr });
    } else if (fee.type === 'percentage' && fee.value > 0) {
      elements.push({ tag: '55', length: 2, value: '03' }); // percentage indicator
      const feeStr = String(fee.value);
      elements.push({ tag: '57', length: feeStr.length, value: feeStr });
    }
  }

  // 5. Rebuild string & recalculate CRC
  let result = '';
  // Sort by tag number (ensure proper order)
  elements.sort((a, b) => parseInt(a.tag, 10) - parseInt(b.tag, 10));
  for (const e of elements) {
    result += e.tag + String(e.value.length).padStart(2, '0') + e.value;
  }

  // Add CRC placeholder then calculate
  result += '6304';
  const checksum = crc16(result).toUpperCase();
  result += checksum;

  return result;
}

// CRC-16/CCITT-FALSE
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).padStart(4, '0');
}
