# Migrasi Supabase

Folder ini berisi skema lengkap yang diperlukan untuk menjalankan JasdorAja
dari project Supabase kosong.

## Urutan Migrasi

Jalankan file berikut secara berurutan melalui **Supabase Dashboard > SQL
Editor**:

| Urutan | File | Isi |
| --- | --- | --- |
| 1 | `001_core.sql` | Extension, tabel `settings`, tabel `orders`, trigger, RLS, dan konfigurasi dasar. |
| 2 | `002_referral.sql` | User referral, referral order, withdrawal, index, RLS, dan konfigurasi reward. |
| 3 | `003_referral_security.sql` | PIN, fraud metadata, device tracking, audit, rate limit, dan RLS. |
| 4 | `004_account_stock.sql` | Konfigurasi awal stok akun. |
| 5 | `005_storage.sql` | Bucket public `proofs` dan `testimonials`. |
| 6 | `006_payment_timeout.sql` | Durasi auto-cancel pembayaran, default 30 menit. |
| 7 | `007_referral_relax.sql` | Policy referral final yang dipakai aplikasi saat ini. |
| 8 | `008_local_catalog.sql` | Kategori, produk, relasi katalog lokal, RLS, dan metadata sinkronisasi publik. |
| 9 | `009_local_outlets.sql` | Direktori outlet lokal, koordinat, RLS, dan metadata sinkronisasi publik. |
| 10 | `010_multi_brand_fore.sql` | Dukungan multi-brand, seed Fore Coffee, index gabungan brand, dan metadata sinkronisasi Fore. |

File menggunakan `IF NOT EXISTS`, `CREATE OR REPLACE`, atau `ON CONFLICT`
sehingga dapat dijalankan ulang pada instalasi normal. Tetap lakukan backup
sebelum menjalankan migrasi pada database production yang sudah berisi data.

## Mengapa Tidak Ada Policy Public

Semua akses database dilakukan dari Next.js route handler melalui
`SUPABASE_SERVICE_ROLE_KEY`. Tabel mengaktifkan RLS dan hak `anon` serta
`authenticated` dicabut agar browser tidak dapat membaca atau menulis tabel
secara langsung.

Service-role key melewati RLS. Karena itu key tersebut wajib tetap berada di
server dan tidak boleh dipakai di kode client.

Bucket `proofs` dan `testimonials` bersifat public hanya untuk pembacaan file
melalui public URL. Tidak ada storage policy upload/delete untuk pengguna anon;
operasi tersebut dilakukan route server menggunakan service role.

## Konfigurasi yang Di-seed

| Key `settings` | Nilai awal |
| --- | --- |
| `service_open` | Layanan terbuka. |
| `service_fee` | Rp7.000. |
| `delivery_config` | Nonaktif, biaya Rp10.000, tanpa outlet. |
| `testimonials` | Daftar kosong. |
| `referral_config` | Reward Rp2.000, minimum withdrawal Rp2.000, aktif. |
| `referral_security` | Policy final dari migrasi `007`. |
| `account_stock` | 10 unit, otomatis, aktif. |
| `payment_timeout` | 30 menit. |
| `catalog_sync` | URL sumber menu publik dan metadata sinkronisasi. |
| `outlet_sync` | URL sumber outlet publik dan metadata sinkronisasi. |

`qris_static` sengaja tidak di-seed. Konfigurasikan QRIS dari dashboard admin
karena nilainya terkait akun merchant.

## Verifikasi

Setelah seluruh migrasi selesai, jalankan query berikut di SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'settings',
    'orders',
    'referral_users',
    'referrals',
    'withdrawals',
    'referral_devices',
    'referral_audit',
    'rate_limits',
    'catalog_categories',
    'catalog_products',
    'catalog_product_categories',
    'outlets',
    'brands'
  )
ORDER BY table_name;
```

Hasilnya harus berisi tiga belas tabel.

Periksa konfigurasi:

```sql
SELECT key, value, updated_at
FROM settings
ORDER BY key;
```

Sebelum QRIS dikonfigurasi, hasil minimal harus memuat:

```text
account_stock
delivery_config
payment_timeout
referral_config
referral_security
service_fee
service_open
testimonials
catalog_sync
outlet_sync
```

Periksa bucket:

```sql
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('proofs', 'testimonials')
ORDER BY id;
```

Keduanya harus memiliki `public = true` dan batas file `5242880` byte.

Periksa RLS:

```sql
SELECT relname, relrowsecurity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND relname IN (
    'settings',
    'orders',
    'referral_users',
    'referrals',
    'withdrawals',
    'referral_devices',
    'referral_audit',
    'rate_limits',
    'catalog_categories',
    'catalog_products',
    'catalog_product_categories',
    'outlets',
    'brands'
  )
ORDER BY relname;
```

Semua nilai `relrowsecurity` harus `true`.

## Reset Development

Untuk project development yang boleh kehilangan seluruh data, cara paling aman
adalah membuat project Supabase baru lalu menjalankan ulang migrasi `001` sampai
`010`. Jangan menjalankan `DROP TABLE` atau menghapus bucket pada database
production tanpa backup dan rencana pemulihan.

## Perubahan Skema Berikutnya

Untuk perubahan berikutnya:

1. Jangan mengedit migrasi lama yang sudah pernah dipakai production.
2. Tambahkan file baru dengan nomor berikutnya, misalnya `008_nama_fitur.sql`.
3. Gunakan SQL idempotent jika memungkinkan.
4. Tambahkan index untuk filter atau sorting baru.
5. Perbarui README ini dan README utama.
6. Uji migrasi pada project Supabase kosong dan salinan database existing.
