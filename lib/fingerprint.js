/**
 * Lightweight client-side device fingerprint.
 * Bukan anti-detect proof, tapi cukup untuk catch farmer biasa.
 */

const FP_KEY = 'jasdor-fp';

export function getFingerprint() {
  if (typeof window === 'undefined') return '';

  // Cached
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
  } catch (_) {}

  const parts = [];

  try {
    parts.push(navigator.userAgent || '');
    parts.push(navigator.language || '');
    parts.push(navigator.platform || '');
    parts.push(navigator.hardwareConcurrency || '');
    parts.push(screen?.width + 'x' + screen?.height);
    parts.push(screen?.colorDepth);
    parts.push(new Date().getTimezoneOffset());
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');

    // Canvas fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#069';
      ctx.fillText('jasdor-fp-' + Date.now().toString().slice(0, -3), 2, 2);
      parts.push(canvas.toDataURL().slice(-50));
    }
  } catch (_) {}

  const raw = parts.join('|');
  const fp = simpleHash(raw);

  try {
    localStorage.setItem(FP_KEY, fp);
  } catch (_) {}

  return fp;
}

function simpleHash(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}
