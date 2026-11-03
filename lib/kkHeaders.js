/**
 * Headers default untuk akses API Kopi Kenangan.
 * Catatan: token (authorization & wtoken) bisa expired suatu saat.
 * Jika data tidak load, refresh token dari aplikasi mobile dan paste ulang di sini.
 */
export const KK_API_BASE_URL =
  process.env.KK_API_BASE_URL ||
  'https://apps.kopikenangan.com/kk-api-kopikenangan/api';

export const KK_HEADERS = {
  accept: 'application/json',
  'accept-encoding': 'gzip',
  'accept-language': 'zh-cn',
  appid: 'kopikenangan',
  appsflyer_id: process.env.KK_APPSFLYER_ID || '',
  authorization: process.env.KK_AUTHORIZATION || '',
  'content-type': 'application/json',
  deviceid: process.env.KK_DEVICE_ID || '',
  devicetype: 'Android',
  gopay_v2: 'true',
  gopay_v3: 'true',
  islogin: 'false',
  language: 'id',
  sign_version: '256',
  supportsharebuy: 'true',
  timezone: '25200',
  'user-agent': 'Dart/3.8 (dart:io)',
  version: process.env.KK_APP_VERSION || '125.08.22',
  versioncode: process.env.KK_APP_VERSION_CODE || '336',
  wtoken: process.env.KK_WTOKEN || '',
};

// Signature unik per endpoint (clsignature). Boleh share antar endpoint, server biasanya
// tidak strict cek. Kalau gagal, ganti dengan signature dari capture endpoint terkait.
export const KK_SIGNATURES = {
  stores: process.env.KK_SIGNATURE_STORES || '',
  menu: process.env.KK_SIGNATURE_MENU || '',
  options: process.env.KK_SIGNATURE_OPTIONS || '',
};

export function isKkApiConfigured(signature) {
  return Boolean(
    KK_API_BASE_URL &&
      KK_HEADERS.authorization &&
      KK_HEADERS.wtoken &&
      KK_HEADERS.deviceid &&
      signature
  );
}
