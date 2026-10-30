-- =====================================================================
--  MIGRASI: Kontrol Tabung Surabaya (kirim tabung kosong → isi → kembali)
-- =====================================================================
--  Jalankan di Supabase → SQL Editor → Run. Aman & idempotent.
-- =====================================================================

-- 1) Pengiriman tabung KOSONG ke Surabaya untuk diisi
create table if not exists public.lpg_sby_kirim (
  id             text primary key,
  tanggal        date not null,
  so             text,              -- nomor SO (1 SO bisa banyak LO)
  no_kont        text,              -- nomor kontainer
  kapal          text,              -- nama kapal
  ekspedisi      text,              -- opsional
  region_asal    text,              -- gudang asal tabung kosong
  qty_50         int not null default 0,
  qty_12         int not null default 0,
  qty_55         int not null default 0,
  status         text not null default 'dikirim',   -- 'dikirim' | 'sampai'
  tanggal_sampai date,
  catatan        text,
  created_at     timestamptz not null default now()
);

-- 2) LO pengisian — tabung TERISI dikirim ke gudang tujuan (1 SO → banyak LO)
create table if not exists public.lpg_sby_lo (
  id             text primary key,
  so             text,              -- mengacu ke SO yang sama
  lo             text,              -- nomor LO (pecahan dari SO)
  tebusan        text,              -- no. tebusan (dokumen penebusan utk pengisian)
  tanggal        date not null,
  region_tujuan  text,              -- gudang tujuan tabung terisi
  qty_50         int not null default 0,
  qty_12         int not null default 0,
  qty_55         int not null default 0,
  status         text not null default 'dikirim',   -- 'dikirim' | 'sampai' (di gudang tujuan)
  tanggal_sampai date,
  catatan        text,
  created_at     timestamptz not null default now()
);

-- Kolom tebusan untuk tabel LO yang mungkin sudah dibuat sebelumnya
alter table public.lpg_sby_lo add column if not exists tebusan text;

-- 3) SO — dibuat sendiri berdasarkan total tabung yang dikirim ke Surabaya.
--    1 SO bisa dipecah menjadi beberapa LO.
create table if not exists public.lpg_sby_so (
  id         text primary key,
  so         text,
  tanggal    date not null,
  qty_50     int not null default 0,
  qty_12     int not null default 0,
  qty_55     int not null default 0,
  catatan    text,
  created_at timestamptz not null default now()
);

-- SO tidak lagi wajib di tabel kirim (dipisah ke lpg_sby_so)
create index if not exists idx_sby_so_so on public.lpg_sby_so (so);
create index if not exists idx_sby_kirim_status on public.lpg_sby_kirim (status);
create index if not exists idx_sby_kirim_so     on public.lpg_sby_kirim (so);
create index if not exists idx_sby_lo_so         on public.lpg_sby_lo (so);
create index if not exists idx_sby_lo_status     on public.lpg_sby_lo (status);

-- RLS + grant (anon CRUD seperti tabel operasional lain)
alter table public.lpg_sby_kirim enable row level security;
alter table public.lpg_sby_lo    enable row level security;
alter table public.lpg_sby_so    enable row level security;
drop policy if exists "anon_all_sby_kirim" on public.lpg_sby_kirim;
drop policy if exists "anon_all_sby_lo"    on public.lpg_sby_lo;
drop policy if exists "anon_all_sby_so"    on public.lpg_sby_so;
create policy "anon_all_sby_kirim" on public.lpg_sby_kirim for all to anon, authenticated using (true) with check (true);
create policy "anon_all_sby_lo"    on public.lpg_sby_lo    for all to anon, authenticated using (true) with check (true);
create policy "anon_all_sby_so"    on public.lpg_sby_so    for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.lpg_sby_kirim, public.lpg_sby_lo, public.lpg_sby_so to anon, authenticated;

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_sby_kirim')
      then alter publication supabase_realtime add table public.lpg_sby_kirim; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_sby_lo')
      then alter publication supabase_realtime add table public.lpg_sby_lo; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_sby_so')
      then alter publication supabase_realtime add table public.lpg_sby_so; end if;
  end if;
end $$;

-- =====================================================================
--  SELESAI ✅
-- =====================================================================
