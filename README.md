# 🔥 LPG Monitor – Multi Region (Multi-Page App)

Sistem monitoring stok tabung Bright Gas Pertamina. Setiap halaman adalah file `.html` mandiri (Multi-Page Application), dikelompokkan per kategori fungsi, dengan sidebar yang sama di-*inject* secara dinamis via `fetch()`.

---

## 📁 Struktur Folder

```
lpg-monitor-final/
├── login.html                        # Halaman login (standalone)
├── pages/
│   ├── dashboard/
│   │   └── dashboard.html
│   ├── transaksi/
│   │   ├── masuk.html                # Input barang masuk
│   │   ├── keluar.html               # Input barang keluar
│   │   ├── riwayat.html              # Riwayat transaksi
│   │   └── import.html               # Import CSV
│   ├── laporan/
│   │   ├── rekap.html                # Rekap bulanan (?region=Ternate / ?region=semua)
│   │   ├── harian.html                # Laporan harian satu region (?region=Ternate)
│   │   └── harian-semua.html          # Laporan harian semua region
│   └── admin/
│       ├── regions.html               # Kelola region/gudang
│       ├── users.html                 # Kelola user
│       └── actlog.html                # Log aktivitas
├── partials/
│   └── sidebar.html                   # Sidebar shared, di-fetch & inject ke setiap halaman
├── css/
│   ├── base.css
│   ├── components.css
│   ├── tables.css
│   ├── forms.css
│   └── responsive.css
└── js/
    ├── config.js                      # MONTHS, REGIONS, TABUNGS, STATUSES, CUR_YEAR, SB_URL, SB_ANON
    ├── state.js                       # S, me, page, alertMsg, modalSt, activeMonth, useSupabase, SB
    ├── supabase-client.js             # loadAllData(), seedDefaultUsers(), setupRealtime()
    ├── data-service.js                # gid(), saveTx, deleteTx, saveStokAwal, dll (CRUD)
    ├── compute.js                     # getTxSum, getStokAwal, computeCell (pure functions)
    ├── app-core.js                    # boot(), setContent(), showAlert, showConfirm, logout(), dll
    ├── ui/
    │   ├── sidebar.js                 # loadSidebar (fetch), buildSidebarNav, getActivePage
    │   ├── dashboard.js
    │   ├── form-input.js
    │   ├── import-csv.js
    │   ├── monitor-table.js
    │   ├── laporan-harian.js
    │   ├── harian-semua-region.js
    │   ├── riwayat.js
    │   ├── regions.js
    │   ├── users.js
    │   ├── modal.js
    │   └── activity-log.js
    └── utils/
        ├── export-helpers.js
        └── dom-helpers.js
```

---

## 🧭 Soal Path (relatif) & Base URL

Semua halaman di `pages/{kategori}/{file}.html` memuat aset CSS/JS dengan path **relatif** `../../css/...` dan `../../js/...`. Untuk navigasi antar-halaman dan `fetch('/partials/sidebar.html')`, base URL dihitung **dinamis** di runtime oleh `getBaseUrl()` (`js/ui/sidebar.js`) dan `_coreBaseUrl()` (`js/app-core.js`): keduanya mendeteksi segmen `pages` pada `location.pathname` lalu naik dua level.

Artinya aplikasi bisa dijalankan baik dari **root domain** (`http://localhost/`) maupun dari **subfolder** (mis. XAMPP: `http://localhost/lpg-monitor-final/`) tanpa mengubah kode.

> ⚠️ Tetap WAJIB lewat HTTP server (Apache/XAMPP atau `npx serve`), bukan `file://`, karena sidebar dimuat via `fetch()`.

---

## 🔒 Sidebar SELALU Muncul di Semua Halaman

Beberapa pengaman ditambahkan agar sidebar tidak pernah hilang:

1. **`loadSidebar()` dengan fallback** — jika `fetch('/partials/sidebar.html')` gagal (file hilang/network error), sidebar tetap dirender memakai HTML cadangan inline di `sidebar.js`, bukan menghilang total.
2. **`boot()` di `app-core.js` memuat sidebar TERLEBIH DAHULU**, sebelum cek error koneksi Supabase. Jadi walau database gagal terhubung, sidebar (dan tombol "🚪 Keluar") tetap ada — pengguna tidak pernah terjebak di halaman tanpa navigasi.
3. Semua 11 halaman aplikasi (kecuali `login.html`) memiliki elemen `<div id="sidebar-wrap"></div>` sebagai titik injeksi.

---

## 🚀 Cara Menjalankan

Wajib pakai HTTP server (karena `fetch()` partial sidebar):

```bash
# XAMPP (folder ada di htdocs): cukup nyalakan Apache, lalu buka:
#   http://localhost/lpg-monitor-final/login.html

# atau server statis cepat:
npx serve .
# atau
python -m http.server 8080
```

---

## 🔐 Keamanan & Setup Database

1. **Jalankan migrasi**: buka Supabase → **SQL Editor** → tempel isi [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Aman untuk database yang sudah berisi data (idempotent). Ini akan:
   - Meng-*hash* password yang masih plaintext (bcrypt via `pgcrypto`).
   - Mengaktifkan **RLS** dan **mengunci tabel `lpg_users`** sehingga *anon key* tidak bisa lagi membaca password.
   - Membuat fungsi RPC `lpg_login`, `lpg_list_users`, `lpg_create_user`, `lpg_update_user`, `lpg_delete_user`.
2. **Klien otomatis menyesuaikan**: `login.html`, `supabase-client.js`, dan `users.js` sudah memanggil RPC tersebut. Sebelum migrasi dijalankan, klien otomatis pakai *jalur lama* (fallback) agar aplikasi tidak putus; sesudah migrasi, hanya jalur aman (RPC) yang dipakai.
3. **Anti-XSS**: semua data dari user/DB di-*escape* via `esc()` (`js/utils/dom-helpers.js`) sebelum disisipkan ke HTML.

### ⚠️ Batas keamanan saat ini & roadmap
Aplikasi memakai *publishable/anon key* di browser **tanpa Supabase Auth (JWT)**. Tanpa JWT, RLS tidak bisa membedakan identitas pemanggil, sehingga otorisasi **per-region** untuk tabel operasional (transaksi/stok/region/log) masih ditegakkan di sisi klien. Untuk penegakan penuh di server, langkah berikutnya adalah **migrasi ke Supabase Auth** (login → sesi JWT → policy RLS berbasis `auth.uid()`/klaim role). Migrasi `lpg_users` di atas sudah menyiapkan fondasinya (password ter-hash + akses lewat fungsi).

---

## 🗺️ Mapping Fungsi Lama → File Baru

| Fungsi / Blok | File |
|---|---|
| `MONTHS`, `REGIONS`, `TABUNGS`, `STATUSES`, `CUR_YEAR`, `SB_URL`, `SB_ANON` | `js/config.js` |
| `S`, `me`, `alertMsg`, `modalSt`, `activeMonth`, `useSupabase`, `SB` | `js/state.js` |
| `loadAllData`, `seedDefaultUsers`, `setupRealtime` | `js/supabase-client.js` |
| `gid`, `saveTx`, `deleteTx`, `saveStokAwal`, `saveRegions`, `deleteUser`, `updateTxRegion`, `writeLog` | `js/data-service.js` |
| `getTxSum`, `getStokAwal`, `computeCell` | `js/compute.js` |
| `boot`, `setContent`, `setModal`, `showAlert`, `closeAlert`, `showConfirm`, `closeConfirm`, `doConfirm`, `logout`, `onRealtimeUpdate` | `js/app-core.js` |
| `loadSidebar`, `buildSidebarNav`, `getActivePage`, `toggleSidebar`, `closeSidebar`, `toggleGroup` | `js/ui/sidebar.js` |
| `renderDashboard` | `js/ui/dashboard.js` → `pages/dashboard/dashboard.html` |
| `renderFormInput`, `submitTx`, `confirmDelTx` | `js/ui/form-input.js` → `pages/transaksi/masuk.html`, `keluar.html` |
| `renderImport`, `parseCSVFile`, `confirmImport`, `doImportCSV`, dll | `js/ui/import-csv.js` → `pages/transaksi/import.html` |
| `renderRiwayat` | `js/ui/riwayat.js` → `pages/transaksi/riwayat.html` |
| `renderMonitorTable`, `setSA` | `js/ui/monitor-table.js` → `pages/laporan/rekap.html` |
| `renderLaporanHarian`, dll | `js/ui/laporan-harian.js` → `pages/laporan/harian.html` |
| `renderHarianSemuaRegion`, dll | `js/ui/harian-semua-region.js` → `pages/laporan/harian-semua.html` |
| `renderRegions`, `addRegion`, `saveEditRegion`, dll | `js/ui/regions.js` → `pages/admin/regions.html` |
| `renderUsers`, `saveNewUser`, `saveEditUser`, dll | `js/ui/users.js` → `pages/admin/users.html` |
| `renderCustomers`, `openAddCustomer`, `submitAddCustomer`, `openEditCustomer`, dll | `js/ui/customers.js` → `pages/admin/customers.html` |
| `renderModal` | `js/ui/modal.js` (dipakai di `regions.html` & `users.html`) |
| `ACTION_LABELS`, `loadActLog`, `renderActivityLog`, `exportLogCSV` | `js/ui/activity-log.js` → `pages/admin/actlog.html` |
| `downloadTableById`, `downloadCSV`, `printTable` | `js/utils/export-helpers.js` |
| Semua `<style>` | `css/*.css` |

---

## 🗃️ Database Supabase (tidak berubah)

| Tabel | Keterangan |
|---|---|
| `lpg_users` | Data user (id, username, password, name, role, region) |
| `lpg_regions` | Daftar region/gudang |
| `lpg_transactions` | Transaksi masuk/keluar |
| `lpg_stok_awal` | Stok awal per region/tabung/status/bulan |
| `lpg_activity_log` | Log aktivitas user |
| `lpg_customers` | Master customer (nama, telp, alamat, region) — dipakai autocomplete di form Keluar |
| `lpg_sby_kirim` | Kontrol Surabaya — perjalanan tabung KOSONG gudang asal → Surabaya (dikirim → sampai → dibongkar) |
| `lpg_sby_so` | Kontrol Surabaya — Tebusan/SO (1 jenis tabung per SO) |
| `lpg_sby_lo` | Kontrol Surabaya — LO: pengisian pecahan/utuh dari satu Tebusan/SO (mengurangi stok kosong, menambah stok isi gudang) |
| `lpg_sby_kirim_tujuan` | Kontrol Surabaya — perjalanan tabung ISI Surabaya → gudang tujuan (kontainer & kapal sendiri) |

Auth session disimpan di `sessionStorage` dengan key `lpg_me` (bukan Supabase Auth).
