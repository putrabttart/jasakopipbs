# JasdorAja

Aplikasi jasa order Kopi Kenangan berbasis Next.js 14 dan Supabase. Aplikasi
menyediakan pencarian outlet, katalog menu, keranjang, checkout pickup/delivery,
pembayaran QRIS, upload bukti pembayaran, dashboard admin, stok akun,
testimonial, dan program referral.

## Prasyarat

Siapkan perangkat dan layanan berikut:

- Node.js 20 LTS dan npm 10 atau lebih baru.
- Akun Supabase dan sebuah project Supabase baru.
- Git, jika project diambil dari repository.
- Akun Vercel untuk deployment production dan cron otomatis, jika diperlukan.

Project memakai API private Kopi Kenangan melalui konfigurasi di
`lib/kkHeaders.js`. Token tersebut dapat kedaluwarsa atau berhenti bekerja jika
API pihak ketiga berubah. Pastikan penggunaan API sudah memperoleh izin yang
sesuai sebelum menjalankan aplikasi untuk layanan komersial.

## Menjalankan Dari Nol

### 1. Ambil source dan install dependency

```bash
git clone <URL_REPOSITORY>
cd jasdor-kopken-master
npm install
```

Jangan menjalankan project dari folder yang menjadi root Git untuk seluruh
home directory. Pastikan `git rev-parse --show-toplevel` menunjuk ke folder
project ini agar file pribadi di luar project tidak ikut ter-track.

### 2. Buat project Supabase

1. Buka [Supabase Dashboard](https://supabase.com/dashboard).
2. Pilih **New project**.
3. Simpan database password di password manager.
4. Tunggu sampai database selesai dipersiapkan.
5. Buka **Project Settings > API**.
6. Catat **Project URL** dan secret/service-role key.

Gunakan secret key atau legacy `service_role` key untuk
`SUPABASE_SERVICE_ROLE_KEY`. Jangan gunakan publishable/anon key karena server
memerlukan akses untuk melewati RLS. Key ini tidak boleh digunakan di Client
Component atau diberi prefix `NEXT_PUBLIC_`.

### 3. Jalankan migrasi database

Buka **Supabase Dashboard > SQL Editor**, lalu jalankan semua file berikut satu
per satu sesuai urutan:

```text
supabase-migrations/001_core.sql
supabase-migrations/002_referral.sql
supabase-migrations/003_referral_security.sql
supabase-migrations/004_account_stock.sql
supabase-migrations/005_storage.sql
supabase-migrations/006_payment_timeout.sql
supabase-migrations/007_referral_relax.sql
supabase-migrations/008_local_catalog.sql
supabase-migrations/009_local_outlets.sql
```

Setiap file harus selesai tanpa error sebelum menjalankan file berikutnya.
Migrasi bersifat idempotent untuk instalasi normal sehingga aman dijalankan
ulang. Penjelasan skema dan query verifikasi tersedia di
[`supabase-migrations/README.md`](supabase-migrations/README.md).

### 4. Buat environment lokal

Salin `.env.example` menjadi `.env.local`, lalu isi nilainya:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD=YOUR_LONG_RANDOM_ADMIN_PASSWORD
CRON_SECRET=YOUR_LONG_RANDOM_CRON_SECRET
```

Contoh membuat secret acak dengan Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Jalankan perintah tersebut dua kali untuk menghasilkan password admin dan cron
secret yang berbeda. `.env.local` sudah diabaikan Git dan tidak boleh di-commit.

### 5. Jalankan development server

```bash
npm run dev
```

Buka `http://localhost:3000`. Dashboard admin tersedia di
`http://localhost:3000/admin/login` dan menggunakan `ADMIN_PASSWORD` dari
`.env.local`.

### 6. Konfigurasi awal admin

Setelah login ke `/admin/settings`, periksa dan atur:

1. Status buka/tutup layanan.
2. Biaya jasa.
3. Jumlah stok akun dan pengelolaan stok otomatis.
4. Durasi kedaluwarsa pembayaran.
5. QRIS statis merchant.
6. Outlet dan biaya delivery, jika delivery digunakan.
7. Reward dan batas minimum withdrawal referral.
8. Testimonial, jika ada.

QRIS tidak di-seed oleh migrasi karena merupakan data merchant sensitif.
Pembayaran tidak dapat menghasilkan QR dinamis sebelum QRIS statis disimpan
melalui dashboard admin.

### 7. Uji alur minimum

Sebelum digunakan, verifikasi alur berikut:

1. Halaman utama dapat menampilkan preview menu.
2. Pencarian outlet mengembalikan hasil.
3. Menu outlet dan opsi produk dapat dibuka.
4. Produk dapat masuk ke keranjang dan checkout.
5. Order baru muncul di dashboard admin.
6. QRIS sesuai dengan total pembayaran.
7. Bukti pembayaran dapat diunggah.
8. Admin dapat mengubah status `pending` sampai `done`.
9. Order tanpa bukti bayar dapat dibatalkan oleh endpoint cron.
10. Referral dan withdrawal berfungsi jika fiturnya diaktifkan.

## Perintah Project

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run catalog:sync
npm run outlets:sync
```

- `npm run dev`: menjalankan development server.
- `npm run build`: membuat production build.
- `npm run start`: menjalankan hasil production build.
- `npm run lint`: menjalankan lint bawaan Next.js versi project saat ini.
- `npm run catalog:sync`: bootstrap/sinkronisasi katalog publik ke Supabase
  setelah migrasi `008` dijalankan. Node.js 20.6+ diperlukan untuk membaca
  `.env.local` melalui `--env-file`.
- `npm run outlets:sync`: bootstrap/sinkronisasi outlet Indonesia dari feed
  publik website resmi setelah migrasi `009` dijalankan.

Untuk menguji mode production secara lokal:

```bash
npm run build
npm run start
```

## Deployment Ke Vercel

1. Import repository ke Vercel.
2. Pilih framework preset **Next.js**.
3. Tambahkan environment variable berikut untuk environment Production dan
   Preview yang diperlukan:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
CRON_SECRET
```

4. Deploy project.
5. Buka deployment URL dan ulangi uji alur minimum.
6. Pastikan cron pada `vercel.json` terdaftar di halaman **Settings > Cron Jobs**.

`vercel.json` menjalankan `/api/cron/auto-cancel` setiap lima menit. Untuk
external cron, kirim request berikut:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR_DOMAIN/api/cron/auto-cancel
```

Jangan membiarkan `CRON_SECRET` kosong pada production.

## Struktur Project

```text
app/
  api/                  Next.js route handlers
  admin/                dashboard admin
  menu/, cart/          katalog dan keranjang
  checkout/, payment/   checkout dan pembayaran
  order/, orders/       detail dan riwayat order
  referral/, withdraw/  referral dan penarikan saldo
components/             UI dan state keranjang
lib/                    Supabase, referral, QRIS, security, dan helper API
public/                 aset statis
supabase-migrations/    skema, seed konfigurasi, dan storage Supabase
```

## Environment Variables

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Ya | URL project Supabase. Boleh tersedia di browser, walau aplikasi saat ini mengaksesnya dari server. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Secret/service-role key Supabase. Server-only dan tidak boleh diekspos. |
| `ADMIN_PASSWORD` | Ya | Password dashboard dan API admin. Gunakan nilai acak yang panjang. |
| `CRON_SECRET` | Production | Secret untuk pemanggilan endpoint auto-cancel dari external cron. |
| `KK_API_BASE_URL` dan `KK_*` lainnya | Opsional | Hanya untuk fallback private API jika memiliki integrasi resmi. Katalog menu lokal tidak memerlukannya. |

## Database dan Storage

Tabel yang dibuat migrasi:

- `settings`: konfigurasi runtime aplikasi.
- `orders`: data dan status order.
- `referral_users`: akun referral berbasis nomor WhatsApp.
- `referrals`: reward referral per order.
- `withdrawals`: permintaan penarikan saldo.
- `referral_devices`: jejak device untuk fraud detection.
- `referral_audit`: audit aktivitas referral.
- `rate_limits`: rate limit berbasis database.
- `catalog_categories`: kategori katalog lokal.
- `catalog_products`: produk, harga, gambar, dan status katalog lokal.
- `catalog_product_categories`: relasi produk dengan kategori.
- `outlets`: direktori outlet lokal, alamat, koordinat, dan jam operasional.

Bucket yang dibuat migrasi:

- `proofs`: bukti pembayaran.
- `testimonials`: gambar testimonial.

Kedua bucket bersifat public karena UI menggunakan public URL untuk menampilkan
gambar. Operasi tulis tetap dilakukan oleh route server dengan service-role key.

## Troubleshooting

### `Supabase belum dikonfigurasi`

Pastikan `.env.local` tersedia, nama variable benar, dan development server
di-restart setelah environment berubah.

### `relation ... does not exist`

Migrasi belum lengkap atau dijalankan tidak berurutan. Jalankan seluruh file
`001` sampai `009` dan gunakan query verifikasi di dokumentasi migrasi.

### Upload gagal karena bucket tidak ditemukan

Jalankan `supabase-migrations/005_storage.sql`, lalu periksa bucket `proofs` dan
`testimonials` di **Storage** pada Supabase Dashboard.

### Menu atau outlet tidak muncul

Untuk menu, jalankan `008_local_catalog.sql`, lalu buka **Admin > Settings >
Katalog Menu** dan tekan **Sinkronkan**. Untuk outlet, jalankan
`009_local_outlets.sql`, lalu buka **Admin > Settings > Data Outlet** dan tekan
**Sinkronkan**. Data awal keduanya
diambil dari feed JSON publik yang digunakan website resmi Kopi Kenangan,
kemudian dibaca dari Supabase. Harga merupakan harga mulai dan dapat berbeda
antar-outlet. Tidak diperlukan Google API key atau konfigurasi private `KK_*`.

### Mengelola katalog lokal

Katalog kosong otomatis mencoba bootstrap saat `/api/menu` pertama dipanggil.
Admin juga dapat memicu sinkronisasi dari **Settings > Katalog Menu**. Produk
yang diedit admin diberi `manual_override`, sehingga nama, deskripsi, gambar,
harga, status habis, dan status aktif tidak ditimpa sinkronisasi berikutnya.

### Mengelola outlet lokal

Outlet kosong otomatis mencoba bootstrap saat pencarian pertama. Admin dapat
memicu sinkronisasi dari **Settings > Data Outlet**. Outlet yang diedit admin
ditandai `manual_override` sehingga tidak ditimpa sinkronisasi berikutnya.
Outlet yang sudah hilang dari sumber dinonaktifkan, bukan dihapus.

### QRIS belum tersedia

Login ke `/admin/settings` dan simpan QRIS statis merchant yang valid.

### Cron tidak membatalkan order

Periksa `CRON_SECRET`, status Vercel Cron, nilai payment timeout, usia order,
dan apakah order sudah memiliki `proof_url`. Order dengan bukti pembayaran
sengaja dilewati oleh auto-cancel.

## Catatan Keamanan

- Jangan commit `.env.local`, service-role key, password admin, atau QRIS.
- Rotasi secret yang pernah masuk repository atau log.
- Service-role key melewati RLS; hanya gunakan dari server.
- Backup database sebelum mengubah migrasi pada project yang sudah berisi data.
- Untuk production, perkuat kembali validasi harga server, akses detail order,
  autentikasi admin, dan otorisasi upload sebagaimana dicatat dalam audit proyek.
#   j a s a k o p i p b s  
 