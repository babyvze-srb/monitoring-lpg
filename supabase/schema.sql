-- =====================================================================
--  LPG MONITOR — SETUP DATABASE SUPABASE (FRESH INSTALL)
-- =====================================================================
--  Cara pakai:
--    Supabase → SQL Editor → New query → tempel SELURUH isi file ini → Run.
--
--  ⚠️  BAGIAN 0 (DROP) MENGHAPUS SEMUA DATA tabel lpg_*.
--      Gunakan untuk instal bersih / reset total. Aman dijalankan ulang.
--
--  Akun default setelah setup:
--    admin / admin123      → Super Admin
--    ternate / ternate123  → Operator (region Ternate)
--    tobelo / tobelo123     → Operator (region Tobelo)
--    tidore / tidore123     → Operator (region Tidore)
--    morotai / morotai123   → Operator (region Morotai)
--    bacan / bacan123       → Operator (region Bacan)
--  (Password TERSIMPAN ter-hash bcrypt; segera ganti dari menu Kelola User.)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. DROP (reset bersih) — hapus fungsi & tabel lama bila ada
-- ---------------------------------------------------------------------
drop function if exists public.lpg_login(text, text);
drop function if exists public.lpg_list_users();
drop function if exists public.lpg_create_user(text, text, text, text, text, text);
drop function if exists public.lpg_update_user(text, text, text, text, text, text);
drop function if exists public.lpg_delete_user(text);

drop table if exists public.lpg_activity_log cascade;
drop table if exists public.lpg_stok_awal   cascade;
drop table if exists public.lpg_transactions cascade;
drop table if exists public.lpg_users        cascade;
drop table if exists public.lpg_regions      cascade;

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------
create table public.lpg_regions (
  name        text primary key,
  sort_order  int  not null default 0
);

create table public.lpg_users (
  id        text primary key,
  username  text unique not null,
  password  text not null,                 -- disimpan sebagai hash bcrypt
  name      text not null,
  role      text not null default 'operator' check (role in ('superadmin','operator')),
  region    text
);

create table public.lpg_transactions (
  id         text primary key,
  type       text not null check (type in ('masuk','keluar')),
  region     text not null,
  tanggal    date not null,
  no_sj      text,
  pihak      text,
  tabung     text not null,
  status     text not null,
  qty        int  not null check (qty > 0),
  ket        text,
  month_idx  int  not null check (month_idx between 0 and 11),
  year       int  not null,
  created_at timestamptz not null default now()
);

create table public.lpg_stok_awal (
  region     text not null,
  tabung     text not null,
  status     text not null,
  month_idx  int  not null,
  year       int  not null,
  qty        int  not null default 0,
  constraint lpg_stok_awal_unique unique (region, tabung, status, month_idx, year)
);

create table public.lpg_activity_log (
  id         text primary key,
  user_id    text,
  username   text,
  name       text,
  role       text,
  region     text,
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

-- Index untuk query yang sering dipakai aplikasi
create index idx_tx_year        on public.lpg_transactions (year);
create index idx_tx_region_year on public.lpg_transactions (region, year);
create index idx_tx_tanggal     on public.lpg_transactions (tanggal);
create index idx_stok_year      on public.lpg_stok_awal (year);
create index idx_log_created    on public.lpg_activity_log (created_at desc);

-- ---------------------------------------------------------------------
-- 2. SEED DATA DEFAULT
-- ---------------------------------------------------------------------
insert into public.lpg_regions (name, sort_order) values
  ('Ternate',0),('Tobelo',1),('Tidore',2),('Morotai',3),('Bacan',4);

insert into public.lpg_users (id, username, password, name, role, region) values
  ('sa','admin',   crypt('admin123',  gen_salt('bf')),'Super Admin',      'superadmin', null),
  ('u1','ternate', crypt('ternate123',gen_salt('bf')),'Operator Ternate', 'operator',   'Ternate'),
  ('u2','tobelo',  crypt('tobelo123', gen_salt('bf')),'Operator Tobelo',  'operator',   'Tobelo'),
  ('u3','tidore',  crypt('tidore123', gen_salt('bf')),'Operator Tidore',  'operator',   'Tidore'),
  ('u4','morotai', crypt('morotai123',gen_salt('bf')),'Operator Morotai', 'operator',   'Morotai'),
  ('u5','bacan',   crypt('bacan123',  gen_salt('bf')),'Operator Bacan',   'operator',   'Bacan');

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.lpg_regions       enable row level security;
alter table public.lpg_transactions  enable row level security;
alter table public.lpg_stok_awal     enable row level security;
alter table public.lpg_activity_log  enable row level security;
alter table public.lpg_users         enable row level security;

-- Tabel users DIKUNCI: tidak ada policy untuk anon → akses langsung ditolak.
-- Semua interaksi user lewat fungsi RPC (bagian 5).
revoke all on public.lpg_users from anon, authenticated;

-- Tabel operasional: anon boleh CRUD (model kepercayaan sama seperti sebelumnya;
-- yang ditutup di sini adalah kebocoran password lewat tabel users).
create policy "anon_all_regions"      on public.lpg_regions      for all to anon, authenticated using (true) with check (true);
create policy "anon_all_transactions" on public.lpg_transactions for all to anon, authenticated using (true) with check (true);
create policy "anon_all_stok_awal"    on public.lpg_stok_awal    for all to anon, authenticated using (true) with check (true);
create policy "anon_all_activity_log" on public.lpg_activity_log for all to anon, authenticated using (true) with check (true);

-- Pastikan privilege tabel tersedia untuk anon (berfungsi meski default
-- privilege project berbeda). Tabel users TIDAK diberi grant (tetap terkunci).
grant select, insert, update, delete
  on public.lpg_regions, public.lpg_transactions, public.lpg_stok_awal, public.lpg_activity_log
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. REALTIME (agar perubahan tersinkron antar klien)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_transactions') then
      alter publication supabase_realtime add table public.lpg_transactions;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_stok_awal') then
      alter publication supabase_realtime add table public.lpg_stok_awal;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. FUNGSI RPC (SECURITY DEFINER) — satu-satunya pintu ke lpg_users
-- ---------------------------------------------------------------------
-- 5a. LOGIN: verifikasi password di server, kembalikan data user TANPA password.
create or replace function public.lpg_login(p_username text, p_password text)
returns table (id text, username text, name text, role text, region text)
language sql
security definer
set search_path = public, extensions
as $$
  select u.id, u.username, u.name, u.role, u.region
  from public.lpg_users u
  where u.username = p_username
    and u.password = crypt(p_password, u.password)
  limit 1;
$$;

-- 5b. DAFTAR USER (halaman Kelola User) — tanpa kolom password.
create or replace function public.lpg_list_users()
returns table (id text, username text, name text, role text, region text)
language sql
security definer
set search_path = public, extensions
as $$
  select id, username, name, role, region
  from public.lpg_users
  order by username;
$$;

-- 5c. TAMBAH USER.
create or replace function public.lpg_create_user(
  p_id text, p_username text, p_password text, p_name text, p_role text, p_region text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.lpg_users (id, username, password, name, role, region)
  values (p_id, p_username, crypt(p_password, gen_salt('bf')), p_name, p_role, p_region);
end;
$$;

-- 5d. EDIT USER (password opsional: kirim NULL/'' untuk tidak mengubah).
create or replace function public.lpg_update_user(
  p_id text, p_username text, p_name text, p_role text, p_region text, p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.lpg_users
  set username = p_username,
      name     = p_name,
      role     = p_role,
      region   = p_region,
      password = case
                   when p_password is null or p_password = '' then password
                   else crypt(p_password, gen_salt('bf'))
                 end
  where id = p_id;
end;
$$;

-- 5e. HAPUS USER (akun 'sa' dilindungi).
create or replace function public.lpg_delete_user(p_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_id = 'sa' then
    raise exception 'Akun Super Admin default tidak boleh dihapus';
  end if;
  delete from public.lpg_users where id = p_id;
end;
$$;

-- 5f. Izinkan anon memanggil fungsi-fungsi di atas.
grant execute on function public.lpg_login(text, text)                          to anon, authenticated;
grant execute on function public.lpg_list_users()                               to anon, authenticated;
grant execute on function public.lpg_create_user(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.lpg_update_user(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.lpg_delete_user(text)                          to anon, authenticated;

-- =====================================================================
--  SELESAI ✅  — Buka login.html, masuk dengan admin / admin123,
--  lalu segera ganti password lewat menu Kelola User.
-- =====================================================================
