# Monitor Stok – LPG & Pelumas

Sistem monitoring stok multi-gudang untuk **LPG, Pelumas Retail, dan Pelumas Drum**, dengan **transfer antar gudang berbasis barcode** antara admin gudang dan sopir. Multi-Page App vanilla JS + Supabase.

---

## Setup

1. Di Supabase → **SQL Editor**, jalankan [`supabase/migration_v3_multiproduk_transfer.sql`](supabase/migration_v3_multiproduk_transfer.sql), lalu [`supabase/migration_v4_transfer_no_sj.sql`](supabase/migration_v4_transfer_no_sj.sql). Keduanya aman untuk data yang sudah ada dan aman dijalankan ulang.
2. Buka **Kelola Produk**, sesuaikan daftar produk pelumas. Produk bawaan hanya contoh.
3. Buka **Kelola User**, buat akun dengan role **Sopir**.
4. Isi stok awal pelumas: pilih kategori di topbar, buka **Rekap Bulanan → Januari**.

Sebelum migrasi dijalankan, aplikasi tetap berjalan sebagai monitor LPG, tetapi pelumas dan transfer barcode belum tersedia.

Wajib lewat HTTP server (XAMPP atau `npx serve .`), bukan `file://`.

> **Kamera sopir hanya bisa dibuka lewat HTTPS** (atau `localhost`). Di alamat `http://192.168.x.x`, browser memblokir kamera; sopir masih bisa memakai **Foto Barcode** atau mengetik kode.

---

## Peran

| Role | Akses |
|---|---|
| Super Admin (`superadmin`) | Semua gudang dan menu admin |
| Admin Gudang (`operator`) | Data gudangnya, membuat transfer, menerbitkan barcode di gudangnya |
| Sopir (`sopir`) | Hanya halaman Scan & Muatan |

---

## Alur Transfer Barcode

```
menunggu ──scan MUAT──▶ jalan ──scan BONGKAR──▶ selesai
                         │  ▲
                 scan SINGGAH  scan LANJUT
                         ▼  │
                        singgah
```

| Langkah | Yang terjadi |
|---|---|
| Admin asal membuat transfer | Stok belum berubah, tetapi jumlahnya dipesan sehingga tidak bisa dipakai transfer lain |
| Sopir scan **Muat** | Stok gudang asal berkurang, barang tercatat di sopir. Bila sopir tidak ditentukan, sopir pertama yang memindai menjadi pembawanya |
| Sopir scan **Singgah** (opsional) | Pilihan admin: barang tetap di sopir, atau dititipkan di gudang. Titipan tidak menambah stok gudang singgah. Gudang singgah boleh di luar rencana |
| Sopir scan **Lanjut** | Perjalanan berlanjut, bisa berganti sopir |
| Sopir scan **Bongkar** | Stok gudang tujuan bertambah, transfer selesai |

Aturan yang ditegakkan server:

- Barcode sekali pakai, berlaku 30 menit, dan hanya satu yang aktif per transfer.
- Stok diperiksa ulang saat muat; scan yang gagal tidak mengubah apa pun.
- Transfer hanya bisa dibatalkan sebelum dimuat. Setelah dimuat, gunakan **Alih Tujuan** (termasuk kembali ke gudang asal).
- Setiap muat dan bongkar menulis `lpg_transactions`, sehingga dashboard, rekap, laporan, dan riwayat ikut berubah. Baris ini terkunci dari edit manual.

---

## Alat Tunjuk Tampilan

Khusus `localhost`: tahan **Alt** untuk menyorot bagian halaman, klik untuk menulis perubahan yang diinginkan, lalu tekan **Salin**. Isi kolom input tidak ikut disalin. Kodenya ada di `js/ui/inspector.js`.

---

## Struktur

```
├── login.html
├── pages/
│   ├── dashboard/dashboard.html
│   ├── transfer/transfer.html        # Admin: buat transfer, barcode, pantau rute
│   ├── transfer/sopir.html           # Sopir: scan & muatan (mobile-first)
│   ├── transaksi/                    # masuk, keluar, riwayat, import, pengantaran,
│   │                                 # pinjaman, penerimaan, surabaya-*
│   ├── laporan/                      # rekap, harian, harian-semua
│   └── admin/                        # products, regions, customers, users, actlog
├── partials/sidebar.html
├── css/                              # base (token desain), components, tables, forms, responsive
├── js/
│   ├── config.js                     # Kategori, tema, localDate()
│   ├── state.js
│   ├── supabase-client.js            # Muat data & realtime
│   ├── data-service.js               # CRUD + pemanggil RPC transfer
│   ├── compute.js                    # Stok, kategori, status & rute transfer
│   ├── app-core.js                   # boot, toast, dialog, pilihan kategori di topbar
│   ├── ui/                           # Satu file per halaman
│   └── utils/
└── supabase/                         # schema.sql + migrasi
```

### Kategori

Nama produk disimpan di kolom `tabung` pada transaksi dan stok awal, jadi `compute.js` dan semua laporan berlaku untuk semua kategori. `TABUNGS` dan `STATUSES` adalah cermin kategori aktif. `catTx()` menyaring transaksi kategori aktif.

| Kategori | Satuan | Status |
|---|---|---|
| LPG | tabung | ISI, KOSONG, BOCOR |
| Pelumas Retail | pcs | BAIK, RUSAK |
| Pelumas Drum | drum | ISI, KOSONG, RUSAK |

Kontrol Surabaya, Tabung Pinjaman, Penerimaan Pindah, dan Import hanya untuk LPG. Penerimaan Pindah hanya muncul di menu selama masih ada pindahan lama yang menunggu ACC.

### Tabel baru

| Tabel | Keterangan |
|---|---|
| `lpg_products` | Master produk per kategori, termasuk batas minimum stok |
| `lpg_transfers` | Transfer: rute, sopir, status, posisi barang (`custody`) |
| `lpg_transfer_items` | Barang per transfer |
| `lpg_transfer_events` | Jejak perjalanan |
| `lpg_transfer_tokens` | Barcode. Terkunci, hanya bisa diakses lewat fungsi |

Perubahan transfer hanya lewat RPC `lpg_transfer_create`, `lpg_transfer_issue_token`, `lpg_transfer_scan`, `lpg_transfer_cancel`, dan `lpg_transfer_reroute`.

---

## Batas Keamanan

Aplikasi memakai anon key di browser **tanpa Supabase Auth (JWT)**. Fungsi transfer memeriksa peran dan gudang berdasarkan ID pengguna yang dikirim klien, tetapi server tidak bisa membuktikan bahwa ID itu benar-benar milik pemanggil. Tabel transaksi lama juga masih bisa ditulis langsung dengan anon key. Penegakan penuh memerlukan migrasi ke Supabase Auth.

Password tersimpan ter-hash, `lpg_users` dan `lpg_transfer_tokens` terkunci RLS, dan data dinamis di-escape dengan `esc()`.

Sesi login disimpan di `sessionStorage` dengan key `lpg_me`.
