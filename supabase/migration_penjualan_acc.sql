-- =====================================================================
--  MIGRASI: Penjualan / Pindah Gudang, Status Pengantaran (ACC),
--           Tabung Balik & Pinjaman Tabung
-- =====================================================================
--  Jalankan di Supabase → SQL Editor → Run. Aman & idempotent
--  (hanya menambah kolom, tidak menghapus data).
-- =====================================================================

alter table public.lpg_transactions
  add column if not exists sale_type       text,            -- 'penjualan' | 'pindah_gudang' (utk transaksi keluar)
  add column if not exists purchase_type   text,            -- 'isi' | 'isi_tabung' (utk penjualan)
  add column if not exists delivery_status text,            -- 'belum' | 'sebagian' | 'terantar'
  add column if not exists delivered_qty   int     not null default 0,  -- jumlah tabung yang SUDAH terantar (boleh dicicil)
  add column if not exists delivery_date   date,            -- tanggal terantar
  add column if not exists returned_qty    int     not null default 0,  -- jumlah tabung kosong yang sudah balik
  add column if not exists closed          boolean not null default false, -- transaksi selesai (lunas)
  add column if not exists parent_id       text;            -- link: tabung balik / masuk pindah-gudang → transaksi induk

create index if not exists idx_tx_delivery on public.lpg_transactions (delivery_status);
create index if not exists idx_tx_closed   on public.lpg_transactions (closed);
create index if not exists idx_tx_parent   on public.lpg_transactions (parent_id);

-- =====================================================================
--  SELESAI ✅
-- =====================================================================
