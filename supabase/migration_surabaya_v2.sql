-- =====================================================================
--  MIGRASI v2: Alur lengkap Kontrol Tabung Surabaya
--  Kirim kosong → Sampai → Dibongkar (masuk stok gudang) → Tebusan/SO
--  (1 jenis tabung, bisa dipecah jadi beberapa LO) → Pengisian (LO
--  mengurangi stok KOSONG & menambah stok ISI) → Kirim ke gudang tujuan
--  (kontainer & kapal sendiri, mengurangi stok ISI).
-- =====================================================================
--  Jalankan SETELAH migration_surabaya.sql. Di Supabase → SQL Editor →
--  Run. Aman untuk data yang sudah ada (idempotent, hanya ADD COLUMN /
--  CREATE TABLE IF NOT EXISTS — tidak ada data yang dihapus).
-- =====================================================================

-- 1) Kirim kosong ke Surabaya: tambah tahap "dibongkar" (bongkar kontainer).
alter table public.lpg_sby_kirim add column if not exists tanggal_bongkar date;

-- 2) Tebusan / SO — sekarang HANYA SATU JENIS tabung per SO (bukan campuran
--    50/12/5.5 dalam satu SO seperti sebelumnya).
alter table public.lpg_sby_so add column if not exists tabung text;
alter table public.lpg_sby_so add column if not exists qty int not null default 0;
alter table public.lpg_sby_so add column if not exists no_tebusan text;

-- 3) LO — pecahan (atau utuh, 1:1) dari satu Tebusan/SO. Setiap baris LO di
--    sini MENCATAT AKSI PENGISIAN NYATA: begitu disimpan, stok KOSONG
--    gudang Surabaya berkurang sejumlah qty & stok ISI bertambah sejumlah
--    qty (dihitung otomatis di klien dari kumpulan baris ini).
alter table public.lpg_sby_lo add column if not exists so_id text;
alter table public.lpg_sby_lo add column if not exists tabung text;
alter table public.lpg_sby_lo add column if not exists qty int not null default 0;
create index if not exists idx_sby_lo_so_id on public.lpg_sby_lo (so_id);

-- 4) Perjalanan tabung ISI: Surabaya → gudang tujuan (kontainer & kapal
--    tersendiri, terpisah dari perjalanan tabung kosong di #1).
create table if not exists public.lpg_sby_kirim_tujuan (
  id             text primary key,
  tanggal        date not null,
  tabung         text not null,
  qty            int not null default 0,
  region_tujuan  text,
  no_kont        text,
  kapal          text,
  ekspedisi      text,
  status         text not null default 'dikirim',   -- 'dikirim' | 'sampai'
  tanggal_sampai date,
  catatan        text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_sby_kirim_tujuan_status on public.lpg_sby_kirim_tujuan (status);

alter table public.lpg_sby_kirim_tujuan enable row level security;
drop policy if exists "anon_all_sby_kirim_tujuan" on public.lpg_sby_kirim_tujuan;
create policy "anon_all_sby_kirim_tujuan" on public.lpg_sby_kirim_tujuan for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.lpg_sby_kirim_tujuan to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_sby_kirim_tujuan')
      then alter publication supabase_realtime add table public.lpg_sby_kirim_tujuan; end if;
  end if;
end $$;

-- =====================================================================
--  SELESAI ✅   (Kolom lama qty_50/qty_12/qty_55 di lpg_sby_so & lpg_sby_lo
--  DIBIARKAN apa adanya untuk kompatibilitas mundur — aplikasi versi baru
--  tidak lagi memakainya, memakai kolom tabung + qty di atas.)
-- =====================================================================
