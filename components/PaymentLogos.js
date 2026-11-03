/**
 * Logo & nama metode pembayaran.
 * E-wallet pakai logo (dengan fallback SVG),
 * Bank pakai text saja untuk tampilan yang lebih bersih.
 */

import { useState } from 'react';

const FALLBACK_COLORS = {
  GoPay: { bg: '#00AED6', color: 'white' },
  OVO: { bg: '#4C2A86', color: 'white' },
  DANA: { bg: '#118EEA', color: 'white' },
  ShopeePay: { bg: '#EE4D2D', color: 'white' },
};

export const EWALLET_METHODS = [
  {
    name: 'GoPay',
    url: 'https://api.typedream.com/v0/document/public/63415083-1cfa-45b6-a801-eaea508fe972/2oYgiVPUa27XyepRpUf6O2SEcnG_cover_294.jpg',
  },
  {
    name: 'OVO',
    url: 'https://play-lh.googleusercontent.com/5S2rYbdnZMc9V_6kPHMuh7aJf9tKh129v9qTRqVSRzWhtmS7T0DUZdeBKyyuFENlz441cAKv7D4UjKcwMGTE',
  },
  {
    name: 'DANA',
    url: 'https://cdn.prod.website-files.com/69bbe852f53519cb6c8930fa/69bbe852f53519cb6c89438a_64ef34bfd54103e5e4190415_Dana.svg',
  },
  {
    name: 'ShopeePay',
    url: 'https://fintechid-bucket.s3.ap-southeast-3.amazonaws.com/aftech/assets/files/shares/logo/logofi2/ShopeePay.png',
  },
];

export const BANK_METHODS = ['LinkAja', 'BCA', 'Mandiri', 'BNI', 'BRI'];

/**
 * Komponen logo dengan auto-fallback ke SVG inline.
 */
export function PaymentLogo({ name, url, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (failed || !url) {
    const colors = FALLBACK_COLORS[name] || { bg: '#71717A', color: 'white' };
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 120 50"
        preserveAspectRatio="xMidYMid meet"
        className={className}
      >
        <rect width="120" height="50" rx="6" fill={colors.bg} />
        <text
          x="60"
          y="32"
          textAnchor="middle"
          fill={colors.color}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={name.length > 6 ? 12 : 16}
          fontWeight="800"
        >
          {name}
        </text>
      </svg>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className={'max-h-6 max-w-full object-contain ' + className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
