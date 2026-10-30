-- =====================================================================
--  MIGRASI v4: No. Surat Jalan wajib pada Transfer Barcode
-- =====================================================================
--  Jalankan setelah migration_v3. Aman dijalankan ulang, tidak menghapus data.
--  Transfer lama tanpa No. SJ tetap memakai kode transfer di transaksinya.
-- =====================================================================

alter table public.lpg_transfers add column if not exists no_sj text;

-- Fungsi lama tanpa No. SJ dihapus agar syarat wajib tidak bisa dilewati.
drop function if exists public.lpg_transfer_create(text,text,text,text,text,text,text[],jsonb,date);

create or replace function public.lpg_transfer_create(
  p_actor text, p_origin text, p_destination text, p_driver_id text,
  p_vehicle text, p_note text, p_stops text[], p_items jsonb, p_date date, p_no_sj text
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
  clean_sj text := nullif(trim(p_no_sj),'');
  yr int := extract(year from p_date)::int;
begin
  actor := public.lpg_require_admin_at(p_actor, p_origin);
  if clean_sj is null then raise exception 'No. Surat Jalan wajib diisi'; end if;
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
    (id, code, no_sj, origin, destination, stops, driver_id, driver_name, vehicle, note, created_by, created_by_name, tanggal)
  values
    (new_id, new_code, clean_sj, p_origin, p_destination, clean_stops, drv.id, drv.name,
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
    new_code||' | SJ '||clean_sj||' | '||p_origin||' -> '||p_destination);
  return json_build_object('id', new_id, 'code', new_code);
end;
$$;

-- Transaksi muat dan bongkar memakai No. SJ transfer.
create or replace function public.lpg_transfer_post_tx(
  p_t public.lpg_transfers, p_type text, p_region text, p_date date, p_ket text
) returns void language plpgsql
set search_path = public
as $$
begin
  insert into public.lpg_transactions
    (id, type, region, tanggal, no_sj, pihak, tabung, status, qty, ket, month_idx, year,
     sale_type, delivery_status, delivery_date, closed, category, transfer_id)
  select gen_random_uuid()::text, p_type, p_region, p_date, coalesce(p_t.no_sj, p_t.code),
         coalesce(p_t.driver_name,''), i.product, i.status, i.qty, p_ket,
         extract(month from p_date)::int - 1, extract(year from p_date)::int,
         'pindah_gudang', case when p_type='masuk' then 'terantar' end,
         case when p_type='masuk' then p_date end, true, i.category, p_t.id
    from public.lpg_transfer_items i where i.transfer_id=p_t.id;
end;
$$;

revoke execute on function public.lpg_transfer_post_tx(public.lpg_transfers,text,text,date,text) from public, anon, authenticated;
grant execute on function public.lpg_transfer_create(text,text,text,text,text,text,text[],jsonb,date,text) to anon, authenticated;

notify pgrst, 'reload schema';
