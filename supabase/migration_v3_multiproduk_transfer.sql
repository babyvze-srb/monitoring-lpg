-- =====================================================================
--  MIGRASI v3: Multi-Produk (LPG, Pelumas Retail, Pelumas Drum) &
--              Transfer Gudang dengan Barcode (Admin Gudang <-> Sopir)
-- =====================================================================
--  Jalankan di Supabase -> SQL Editor -> Run.
--  Aman & idempotent: hanya MENAMBAH tabel/kolom/fungsi, tidak menghapus data.
--
--  Alur transfer (semua perpindahan stok terjadi di server, atomik):
--
--    menunggu --[scan MUAT di gudang asal]--> jalan   (stok asal berkurang,
--                                                      barang dipegang sopir)
--    jalan    --[scan SINGGAH]-------------> singgah  (barang tetap di sopir,
--                                                      atau dititipkan di gudang)
--    singgah  --[scan LANJUT]--------------> jalan    (bisa ganti sopir)
--    jalan    --[scan BONGKAR di tujuan]---> selesai  (stok tujuan bertambah)
--
--  Barcode bersifat sekali pakai, berlaku 30 menit, dan hanya 1 yang aktif
--  per transfer. Setiap scan muat/bongkar menulis baris ke lpg_transactions
--  sehingga rekap, laporan harian, riwayat & dashboard ikut berubah otomatis.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLE SOPIR  ('operator' tetap dipakai sebagai Admin Gudang)
-- ---------------------------------------------------------------------
alter table public.lpg_users drop constraint if exists lpg_users_role_check;
alter table public.lpg_users add constraint lpg_users_role_check
  check (role in ('superadmin','operator','sopir'));

-- ---------------------------------------------------------------------
-- 2. MASTER PRODUK
--    lpg_transactions.tabung & lpg_stok_awal.tabung menyimpan NAMA produk,
--    jadi name harus unik lintas kategori.
-- ---------------------------------------------------------------------
create table if not exists public.lpg_products (
  id         text primary key,
  category   text not null check (category in ('lpg','pelumas_retail','pelumas_drum')),
  name       text not null unique,
  sort_order int  not null default 0,
  min_stock  int  not null default 0 check (min_stock >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_products_cat on public.lpg_products (category, sort_order);

insert into public.lpg_products (id, category, name, sort_order) values
  ('p-lpg-50',  'lpg', '50 KG',  0),
  ('p-lpg-12',  'lpg', '12 KG',  1),
  ('p-lpg-55',  'lpg', '5.5 KG', 2),
  ('p-ret-1',   'pelumas_retail', 'Enduro 4T 0.8 L',   0),
  ('p-ret-2',   'pelumas_retail', 'Fastron 1 L',       1),
  ('p-ret-3',   'pelumas_retail', 'Mesran Super 1 L',  2),
  ('p-ret-4',   'pelumas_retail', 'Meditran SC 1 L',   3),
  ('p-drm-1',   'pelumas_drum', 'Meditran SX 209 L',   0),
  ('p-drm-2',   'pelumas_drum', 'Mesran Super 209 L',  1),
  ('p-drm-3',   'pelumas_drum', 'Turalik 48 209 L',    2)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. KOLOM BARU PADA TRANSAKSI
-- ---------------------------------------------------------------------
alter table public.lpg_transactions
  add column if not exists category    text not null default 'lpg',
  add column if not exists transfer_id text;
create index if not exists idx_tx_category on public.lpg_transactions (category);
create index if not exists idx_tx_transfer on public.lpg_transactions (transfer_id);

-- ---------------------------------------------------------------------
-- 4. TABEL TRANSFER
-- ---------------------------------------------------------------------
create table if not exists public.lpg_transfers (
  id               text primary key,
  code             text not null unique,
  origin           text not null,
  destination      text not null,
  stops            text[] not null default '{}',   -- rencana gudang singgah
  driver_id        text,                           -- null = sopir pertama yang scan
  driver_name      text,
  vehicle          text,
  note             text,
  status           text not null default 'menunggu'
                   check (status in ('menunggu','jalan','singgah','selesai','batal')),
  custody          text not null default 'asal'
                   check (custody in ('asal','sopir','titip','tujuan')),
  current_location text,                           -- gudang saat singgah
  created_by       text,
  created_by_name  text,
  tanggal          date not null,
  created_at       timestamptz not null default now(),
  picked_at        timestamptz,
  finished_at      timestamptz,
  updated_at       timestamptz not null default now()
);
create index if not exists idx_trf_status on public.lpg_transfers (status);
create index if not exists idx_trf_driver on public.lpg_transfers (driver_id);

create table if not exists public.lpg_transfer_items (
  id          text primary key,
  transfer_id text not null references public.lpg_transfers(id) on delete cascade,
  category    text not null,
  product     text not null,
  status      text not null,
  qty         int  not null check (qty > 0),
  constraint lpg_transfer_items_unique unique (transfer_id, product, status)
);
create index if not exists idx_trf_items_transfer on public.lpg_transfer_items (transfer_id);

create table if not exists public.lpg_transfer_events (
  id          text primary key,
  transfer_id text not null references public.lpg_transfers(id) on delete cascade,
  kind        text not null,
  warehouse   text,
  actor_id    text,
  actor_name  text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_trf_events_transfer on public.lpg_transfer_events (transfer_id, created_at);

-- Barcode: tabel DIKUNCI (tanpa policy), hanya bisa diakses lewat fungsi.
create table if not exists public.lpg_transfer_tokens (
  token          text primary key,
  transfer_id    text not null references public.lpg_transfers(id) on delete cascade,
  kind           text not null check (kind in ('muat','singgah_masuk','singgah_keluar','bongkar')),
  warehouse      text not null,
  titip          boolean not null default false,
  next_driver_id text,
  created_by     text,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  used_by        text,
  revoked_at     timestamptz
);
create index if not exists idx_trf_tokens_transfer on public.lpg_transfer_tokens (transfer_id);

-- ---------------------------------------------------------------------
-- 5. RLS: produk boleh CRUD (sama seperti region); transfer hanya BACA,
--    semua perubahan wajib lewat fungsi agar status & stok tidak bisa kacau.
-- ---------------------------------------------------------------------
alter table public.lpg_products        enable row level security;
alter table public.lpg_transfers       enable row level security;
alter table public.lpg_transfer_items  enable row level security;
alter table public.lpg_transfer_events enable row level security;
alter table public.lpg_transfer_tokens enable row level security;

drop policy if exists "anon_all_products" on public.lpg_products;
create policy "anon_all_products" on public.lpg_products
  for all to anon, authenticated using (true) with check (true);
drop policy if exists "anon_read_transfers" on public.lpg_transfers;
create policy "anon_read_transfers" on public.lpg_transfers
  for select to anon, authenticated using (true);
drop policy if exists "anon_read_transfer_items" on public.lpg_transfer_items;
create policy "anon_read_transfer_items" on public.lpg_transfer_items
  for select to anon, authenticated using (true);
drop policy if exists "anon_read_transfer_events" on public.lpg_transfer_events;
create policy "anon_read_transfer_events" on public.lpg_transfer_events
  for select to anon, authenticated using (true);

grant select, insert, update, delete on public.lpg_products to anon, authenticated;
grant select on public.lpg_transfers, public.lpg_transfer_items, public.lpg_transfer_events to anon, authenticated;
revoke all on public.lpg_transfer_tokens from anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. REALTIME
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['lpg_transfers','lpg_products'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. FUNGSI PEMBANTU (tidak di-grant ke anon)
-- ---------------------------------------------------------------------
create or replace function public.lpg_random_code(p_len int)
returns text language plpgsql volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- tanpa 0/O/1/I
  raw bytea;
  out_code text := '';
begin
  while length(out_code) < p_len loop
    raw := decode(replace(gen_random_uuid()::text,'-',''),'hex');
    for i in 0..15 loop
      exit when length(out_code) >= p_len;
      out_code := out_code || substr(alphabet, (get_byte(raw,i) % 32) + 1, 1);
    end loop;
  end loop;
  return out_code;
end;
$$;

create or replace function public.lpg_status_valid(p_category text, p_status text)
returns boolean language sql immutable
set search_path = public
as $$
  select case p_category
    when 'lpg'            then p_status in ('ISI','KOSONG','BOCOR')
    when 'pelumas_retail' then p_status in ('BAIK','RUSAK')
    when 'pelumas_drum'   then p_status in ('ISI','KOSONG','RUSAK')
    else false end;
$$;

-- Stok fisik di gudang. Harus sama dengan compute.js: stok awal Januari +
-- masuk - keluar, pindah gudang lama yang belum di-ACC belum dihitung.
create or replace function public.lpg_stock_on_hand(p_region text, p_product text, p_status text, p_year int)
returns int language sql stable
set search_path = public
as $$
  select coalesce((select qty from public.lpg_stok_awal
                    where region=p_region and tabung=p_product and status=p_status
                      and month_idx=0 and year=p_year),0)
       + coalesce((select sum(case when type='masuk' then qty else -qty end)::int
                     from public.lpg_transactions
                    where region=p_region and tabung=p_product and status=p_status and year=p_year
                      and not (type='masuk' and sale_type='pindah_gudang'
                               and coalesce(delivery_status,'')='belum')),0);
$$;

-- Stok yang sudah dipesan transfer lain tetapi belum dimuat.
create or replace function public.lpg_stock_reserved(p_region text, p_product text, p_status text)
returns int language sql stable
set search_path = public
as $$
  select coalesce(sum(i.qty),0)::int
    from public.lpg_transfer_items i
    join public.lpg_transfers t on t.id=i.transfer_id
   where t.origin=p_region and t.status='menunggu'
     and i.product=p_product and i.status=p_status;
$$;

create or replace function public.lpg_require_user(p_id text)
returns public.lpg_users language plpgsql stable
set search_path = public
as $$
declare u public.lpg_users;
begin
  select * into u from public.lpg_users where id=p_id;
  if not found then raise exception 'Pengguna tidak dikenal'; end if;
  return u;
end;
$$;

create or replace function public.lpg_require_admin_at(p_actor text, p_warehouse text)
returns public.lpg_users language plpgsql stable
set search_path = public
as $$
declare u public.lpg_users;
begin
  u := public.lpg_require_user(p_actor);
  if u.role='superadmin' then return u; end if;
  if u.role='operator' and u.region=p_warehouse then return u; end if;
  raise exception 'Hanya admin gudang % yang boleh melakukan ini', p_warehouse;
end;
$$;

create or replace function public.lpg_transfer_log(
  p_transfer text, p_kind text, p_warehouse text, p_actor public.lpg_users, p_note text
) returns void language plpgsql
set search_path = public
as $$
begin
  insert into public.lpg_transfer_events (id, transfer_id, kind, warehouse, actor_id, actor_name, note)
  values (gen_random_uuid()::text, p_transfer, p_kind, p_warehouse, p_actor.id, p_actor.name, p_note);
  insert into public.lpg_activity_log (id, user_id, username, name, role, region, action, detail)
  values (gen_random_uuid()::text, p_actor.id, p_actor.username, p_actor.name, p_actor.role, p_actor.region,
          'TRANSFER_'||upper(p_kind), p_note);
end;
$$;

-- Tulis transaksi masuk/keluar untuk seluruh item transfer.
create or replace function public.lpg_transfer_post_tx(
  p_t public.lpg_transfers, p_type text, p_region text, p_date date, p_ket text
) returns void language plpgsql
set search_path = public
as $$
begin
  insert into public.lpg_transactions
    (id, type, region, tanggal, no_sj, pihak, tabung, status, qty, ket, month_idx, year,
     sale_type, delivery_status, delivery_date, closed, category, transfer_id)
  select gen_random_uuid()::text, p_type, p_region, p_date, p_t.code,
         coalesce(p_t.driver_name,''), i.product, i.status, i.qty, p_ket,
         extract(month from p_date)::int - 1, extract(year from p_date)::int,
         'pindah_gudang', case when p_type='masuk' then 'terantar' end,
         case when p_type='masuk' then p_date end, true, i.category, p_t.id
    from public.lpg_transfer_items i where i.transfer_id=p_t.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. API: BUAT TRANSFER
--    p_items = [{"category":"lpg","product":"12 KG","status":"ISI","qty":10}, ...]
-- ---------------------------------------------------------------------
create or replace function public.lpg_transfer_create(
  p_actor text, p_origin text, p_destination text, p_driver_id text,
  p_vehicle text, p_note text, p_stops text[], p_items jsonb, p_date date
) returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  actor public.lpg_users;
  drv   public.lpg_users;
  new_id text := gen_random_uuid()::text;
  new_code text;
  it record;
  avail int;
  stop_name text;
  clean_stops text[] := '{}';
  yr int := extract(year from p_date)::int;
begin
  actor := public.lpg_require_admin_at(p_actor, p_origin);
  if not exists (select 1 from public.lpg_regions where name=p_origin) then
    raise exception 'Gudang asal "%" tidak ada', p_origin;
  end if;
  if not exists (select 1 from public.lpg_regions where name=p_destination) then
    raise exception 'Gudang tujuan "%" tidak ada', p_destination;
  end if;
  if p_origin=p_destination then raise exception 'Gudang tujuan harus berbeda dari gudang asal'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Barang yang dipindah belum diisi';
  end if;

  foreach stop_name in array coalesce(p_stops,'{}') loop
    if not exists (select 1 from public.lpg_regions where name=stop_name) then
      raise exception 'Gudang singgah "%" tidak ada', stop_name;
    end if;
    if stop_name in (p_origin,p_destination) then
      raise exception 'Gudang singgah tidak boleh sama dengan asal atau tujuan';
    end if;
    if not stop_name = any(clean_stops) then clean_stops := clean_stops || stop_name; end if;
  end loop;

  if nullif(p_driver_id,'') is not null then
    drv := public.lpg_require_user(p_driver_id);
    if drv.role<>'sopir' then raise exception 'Pengguna yang dipilih bukan sopir'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('lpg_stock:'||p_origin));

  new_code := 'TRF-'||to_char(p_date,'YYMMDD')||'-'||public.lpg_random_code(4);
  insert into public.lpg_transfers
    (id, code, origin, destination, stops, driver_id, driver_name, vehicle, note, created_by, created_by_name, tanggal)
  values
    (new_id, new_code, p_origin, p_destination, clean_stops, drv.id, drv.name,
     nullif(trim(p_vehicle),''), nullif(trim(p_note),''), actor.id, actor.name, p_date);

  for it in
    select x->>'category' as category, x->>'product' as product, x->>'status' as status,
           sum((x->>'qty')::int)::int as qty
      from jsonb_array_elements(p_items) x
     group by 1,2,3
  loop
    if it.qty is null or it.qty<=0 then raise exception 'Jumlah barang harus lebih dari 0'; end if;
    if not exists (select 1 from public.lpg_products p where p.name=it.product and p.category=it.category) then
      raise exception 'Produk "%" tidak dikenal', it.product;
    end if;
    if not public.lpg_status_valid(it.category, it.status) then
      raise exception 'Status "%" tidak berlaku untuk "%"', it.status, it.product;
    end if;
    avail := public.lpg_stock_on_hand(p_origin, it.product, it.status, yr)
           - public.lpg_stock_reserved(p_origin, it.product, it.status);
    if avail < it.qty then
      raise exception 'Stok % % di % tidak cukup: tersedia %, diminta %',
        it.product, it.status, p_origin, greatest(avail,0), it.qty;
    end if;
    insert into public.lpg_transfer_items (id, transfer_id, category, product, status, qty)
    values (gen_random_uuid()::text, new_id, it.category, it.product, it.status, it.qty);
  end loop;

  perform public.lpg_transfer_log(new_id, 'dibuat', p_origin, actor,
    new_code||' | '||p_origin||' -> '||p_destination);
  return json_build_object('id', new_id, 'code', new_code);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. API: TERBITKAN BARCODE (admin gudang di lokasi truk berada)
-- ---------------------------------------------------------------------
create or replace function public.lpg_transfer_issue_token(
  p_actor text, p_transfer text, p_kind text, p_warehouse text,
  p_titip boolean default false, p_next_driver text default null
) returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  actor public.lpg_users;
  nxt   public.lpg_users;
  t     public.lpg_transfers;
  tok   text;
  exp   timestamptz := now() + interval '30 minutes';
begin
  select * into t from public.lpg_transfers where id=p_transfer for update;
  if not found then raise exception 'Transfer tidak ditemukan'; end if;
  actor := public.lpg_require_admin_at(p_actor, p_warehouse);

  if p_kind='muat' then
    if t.status<>'menunggu' then raise exception 'Transfer % sudah dimuat atau ditutup', t.code; end if;
    if p_warehouse<>t.origin then raise exception 'Barcode muat hanya dari gudang asal (%)', t.origin; end if;
  elsif p_kind='singgah_masuk' then
    if t.status<>'jalan' then raise exception 'Transfer % sedang tidak dalam perjalanan', t.code; end if;
    if p_warehouse=t.destination then raise exception '% adalah gudang tujuan, gunakan barcode bongkar', p_warehouse; end if;
    if not exists (select 1 from public.lpg_regions where name=p_warehouse) then
      raise exception 'Gudang "%" tidak ada', p_warehouse;
    end if;
  elsif p_kind='singgah_keluar' then
    if t.status<>'singgah' then raise exception 'Transfer % sedang tidak singgah', t.code; end if;
    if p_warehouse<>t.current_location then raise exception 'Transfer % sedang singgah di %', t.code, t.current_location; end if;
    if nullif(p_next_driver,'') is not null then
      nxt := public.lpg_require_user(p_next_driver);
      if nxt.role<>'sopir' then raise exception 'Pengguna yang dipilih bukan sopir'; end if;
    end if;
  elsif p_kind='bongkar' then
    if not (t.status='jalan' or (t.status='singgah' and t.current_location=t.destination)) then
      raise exception 'Transfer % belum bisa dibongkar', t.code;
    end if;
    if p_warehouse<>t.destination then raise exception 'Barcode bongkar hanya dari gudang tujuan (%)', t.destination; end if;
  else
    raise exception 'Jenis barcode tidak dikenal';
  end if;

  -- Hanya satu barcode aktif per transfer.
  update public.lpg_transfer_tokens set revoked_at=now()
   where transfer_id=t.id and used_at is null and revoked_at is null;

  tok := public.lpg_random_code(10);
  insert into public.lpg_transfer_tokens
    (token, transfer_id, kind, warehouse, titip, next_driver_id, created_by, expires_at)
  values
    (tok, t.id, p_kind, p_warehouse, coalesce(p_titip,false) and p_kind='singgah_masuk', nxt.id, actor.id, exp);

  return json_build_object('token', tok, 'kind', p_kind, 'warehouse', p_warehouse,
                           'expires_at', exp, 'code', t.code);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. API: SCAN OLEH SOPIR — inti perpindahan barang
-- ---------------------------------------------------------------------
create or replace function public.lpg_transfer_scan(p_driver text, p_token text, p_date date)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  drv public.lpg_users;
  k   public.lpg_transfer_tokens;
  t   public.lpg_transfers;
  it  record;
  have int;
  msg text;
  clean text := upper(regexp_replace(coalesce(p_token,''),'[^A-Za-z0-9]','','g'));
  yr  int := extract(year from p_date)::int;
begin
  drv := public.lpg_require_user(p_driver);
  if drv.role<>'sopir' then raise exception 'Hanya akun sopir yang bisa memindai barcode'; end if;

  select * into k from public.lpg_transfer_tokens where token=clean for update;
  if not found then raise exception 'Barcode tidak dikenal'; end if;
  if k.used_at is not null then raise exception 'Barcode ini sudah pernah dipakai'; end if;
  if k.revoked_at is not null then raise exception 'Barcode ini sudah diganti, minta barcode terbaru ke admin gudang'; end if;
  if k.expires_at < now() then raise exception 'Barcode sudah kedaluwarsa, minta barcode baru ke admin gudang'; end if;

  select * into t from public.lpg_transfers where id=k.transfer_id for update;

  if k.kind='muat' then
    if t.status<>'menunggu' then raise exception 'Transfer % sudah dimuat', t.code; end if;
    if t.driver_id is not null and t.driver_id<>drv.id then
      raise exception 'Transfer % ditugaskan ke %', t.code, t.driver_name;
    end if;
    perform pg_advisory_xact_lock(hashtext('lpg_stock:'||t.origin));
    for it in select * from public.lpg_transfer_items where transfer_id=t.id loop
      have := public.lpg_stock_on_hand(t.origin, it.product, it.status, yr);
      if have < it.qty then
        raise exception 'Stok % % di % tinggal %, tidak cukup untuk memuat %',
          it.product, it.status, t.origin, greatest(have,0), it.qty;
      end if;
    end loop;
    t.driver_id := drv.id; t.driver_name := drv.name;
    perform public.lpg_transfer_post_tx(t, 'keluar', t.origin, p_date, 'Pindah ke '||t.destination||' via sopir '||drv.name);
    update public.lpg_transfers
       set status='jalan', custody='sopir', driver_id=drv.id, driver_name=drv.name,
           picked_at=now(), updated_at=now()
     where id=t.id;
    msg := 'Barang dimuat dari '||t.origin||' dan kini tercatat di Anda';

  elsif k.kind='singgah_masuk' then
    if t.status<>'jalan' then raise exception 'Transfer % sedang tidak dalam perjalanan', t.code; end if;
    if t.driver_id<>drv.id then raise exception 'Transfer % dibawa oleh %', t.code, t.driver_name; end if;
    update public.lpg_transfers
       set status='singgah', current_location=k.warehouse,
           custody=case when k.titip then 'titip' else 'sopir' end, updated_at=now()
     where id=t.id;
    msg := case when k.titip
                then 'Barang dititipkan sementara di '||k.warehouse
                else 'Singgah di '||k.warehouse||', barang tetap di Anda' end;

  elsif k.kind='singgah_keluar' then
    if t.status<>'singgah' then raise exception 'Transfer % sedang tidak singgah', t.code; end if;
    if k.next_driver_id is not null then
      if k.next_driver_id<>drv.id then raise exception 'Barcode ini untuk sopir lain'; end if;
    elsif t.custody<>'titip' and t.driver_id<>drv.id then
      raise exception 'Transfer % dibawa oleh %', t.code, t.driver_name;
    end if;
    if t.driver_id is distinct from drv.id then
      perform public.lpg_transfer_log(t.id, 'ganti_sopir', k.warehouse, drv,
        t.code||' | '||coalesce(t.driver_name,'-')||' -> '||drv.name);
    end if;
    update public.lpg_transfers
       set status='jalan', custody='sopir', current_location=null,
           driver_id=drv.id, driver_name=drv.name, updated_at=now()
     where id=t.id;
    msg := 'Lanjut dari '||k.warehouse||' menuju '||t.destination;

  elsif k.kind='bongkar' then
    if not (t.status='jalan' or (t.status='singgah' and t.current_location=t.destination)) then
      raise exception 'Transfer % belum bisa dibongkar', t.code;
    end if;
    if t.driver_id<>drv.id then raise exception 'Transfer % dibawa oleh %', t.code, t.driver_name; end if;
    t.driver_name := drv.name;
    perform public.lpg_transfer_post_tx(t, 'masuk', t.destination, p_date, 'Pindah dari '||t.origin||' via sopir '||drv.name);
    update public.lpg_transfers
       set status='selesai', custody='tujuan', current_location=null,
           finished_at=now(), updated_at=now()
     where id=t.id;
    msg := 'Barang masuk ke stok gudang '||t.destination;
  end if;

  update public.lpg_transfer_tokens set used_at=now(), used_by=drv.id where token=k.token;
  perform public.lpg_transfer_log(t.id, k.kind, k.warehouse, drv, t.code||' | '||msg);
  return json_build_object('transfer_id', t.id, 'code', t.code, 'kind', k.kind,
                           'warehouse', k.warehouse, 'message', msg);
end;
$$;

-- ---------------------------------------------------------------------
-- 11. API: BATAL (hanya sebelum dimuat) & ALIH TUJUAN (saat di perjalanan)
-- ---------------------------------------------------------------------
create or replace function public.lpg_transfer_cancel(p_actor text, p_transfer text, p_reason text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare actor public.lpg_users; t public.lpg_transfers;
begin
  select * into t from public.lpg_transfers where id=p_transfer for update;
  if not found then raise exception 'Transfer tidak ditemukan'; end if;
  actor := public.lpg_require_admin_at(p_actor, t.origin);
  if t.status<>'menunggu' then
    raise exception 'Transfer % sudah dimuat, gunakan Alih Tujuan untuk mengembalikan barang', t.code;
  end if;
  update public.lpg_transfers set status='batal', updated_at=now(), finished_at=now() where id=t.id;
  update public.lpg_transfer_tokens set revoked_at=now()
   where transfer_id=t.id and used_at is null and revoked_at is null;
  perform public.lpg_transfer_log(t.id, 'batal', t.origin, actor, t.code||' | '||coalesce(nullif(trim(p_reason),''),'Dibatalkan'));
end;
$$;

create or replace function public.lpg_transfer_reroute(p_actor text, p_transfer text, p_destination text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare actor public.lpg_users; t public.lpg_transfers;
begin
  select * into t from public.lpg_transfers where id=p_transfer for update;
  if not found then raise exception 'Transfer tidak ditemukan'; end if;
  actor := public.lpg_require_user(p_actor);
  if not (actor.role='superadmin'
          or (actor.role='operator' and coalesce(actor.region = any(array[t.origin, t.destination, t.current_location]), false))) then
    raise exception 'Hanya admin gudang terkait yang boleh mengalihkan tujuan';
  end if;
  if t.status not in ('jalan','singgah') then raise exception 'Hanya transfer yang sedang di perjalanan yang bisa dialihkan'; end if;
  if not exists (select 1 from public.lpg_regions where name=p_destination) then
    raise exception 'Gudang "%" tidak ada', p_destination;
  end if;
  if p_destination=t.destination then raise exception 'Tujuan baru sama dengan tujuan sekarang'; end if;
  update public.lpg_transfers
     set destination=p_destination, stops=array_remove(stops,p_destination), updated_at=now()
   where id=t.id;
  update public.lpg_transfer_tokens set revoked_at=now()
   where transfer_id=t.id and used_at is null and revoked_at is null;
  perform public.lpg_transfer_log(t.id, 'alih_tujuan', p_destination, actor,
    t.code||' | '||t.destination||' -> '||p_destination);
end;
$$;

-- ---------------------------------------------------------------------
-- 12. API: GANTI NAMA PRODUK (ikut memperbarui semua riwayat)
-- ---------------------------------------------------------------------
create or replace function public.lpg_product_rename(p_id text, p_new_name text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare old_name text; clean text := trim(p_new_name);
begin
  select name into old_name from public.lpg_products where id=p_id for update;
  if not found then raise exception 'Produk tidak ditemukan'; end if;
  if clean='' then raise exception 'Nama produk tidak boleh kosong'; end if;
  if exists (select 1 from public.lpg_products where name=clean and id<>p_id) then
    raise exception 'Nama produk "%" sudah dipakai', clean;
  end if;
  update public.lpg_products       set name=clean     where id=p_id;
  update public.lpg_transactions   set tabung=clean   where tabung=old_name;
  update public.lpg_stok_awal      set tabung=clean   where tabung=old_name;
  update public.lpg_transfer_items set product=clean  where product=old_name;
end;
$$;

-- ---------------------------------------------------------------------
-- 13. API: GANTI NAMA GUDANG (ikut memperbarui data transfer)
-- ---------------------------------------------------------------------
create or replace function public.lpg_transfer_rename_region(p_old text, p_new text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  update public.lpg_transfers set origin=p_new where origin=p_old;
  update public.lpg_transfers set destination=p_new where destination=p_old;
  update public.lpg_transfers set current_location=p_new where current_location=p_old;
  update public.lpg_transfers set stops=array_replace(stops,p_old,p_new) where p_old=any(stops);
  update public.lpg_transfer_events set warehouse=p_new where warehouse=p_old;
  update public.lpg_transfer_tokens set warehouse=p_new where warehouse=p_old;
end;
$$;

-- ---------------------------------------------------------------------
-- 14. HAK AKSES FUNGSI
-- ---------------------------------------------------------------------
-- Supabase memberi anon hak execute secara default: cabut dari keduanya.
revoke execute on function public.lpg_random_code(int) from public, anon, authenticated;
revoke execute on function public.lpg_require_user(text) from public, anon, authenticated;
revoke execute on function public.lpg_require_admin_at(text,text) from public, anon, authenticated;
revoke execute on function public.lpg_transfer_log(text,text,text,public.lpg_users,text) from public, anon, authenticated;
revoke execute on function public.lpg_transfer_post_tx(public.lpg_transfers,text,text,date,text) from public, anon, authenticated;

grant execute on function public.lpg_stock_on_hand(text,text,text,int) to anon, authenticated;
grant execute on function public.lpg_stock_reserved(text,text,text) to anon, authenticated;
grant execute on function public.lpg_transfer_create(text,text,text,text,text,text,text[],jsonb,date) to anon, authenticated;
grant execute on function public.lpg_transfer_issue_token(text,text,text,text,boolean,text) to anon, authenticated;
grant execute on function public.lpg_transfer_scan(text,text,date) to anon, authenticated;
grant execute on function public.lpg_transfer_cancel(text,text,text) to anon, authenticated;
grant execute on function public.lpg_transfer_reroute(text,text,text) to anon, authenticated;
grant execute on function public.lpg_product_rename(text,text) to anon, authenticated;
grant execute on function public.lpg_transfer_rename_region(text,text) to anon, authenticated;

-- PostgREST perlu memuat ulang daftar tabel & fungsi baru.
notify pgrst, 'reload schema';

-- =====================================================================
--  SELESAI. Buat akun sopir dari menu Kelola User (role: Sopir).
-- =====================================================================
