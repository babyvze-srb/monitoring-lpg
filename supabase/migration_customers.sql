-- =====================================================================
--  MIGRASI: Master Customer (agar transaksi keluar sinkron dgn customer)
-- =====================================================================
--  Jalankan di Supabase → SQL Editor → Run. Aman & idempotent.
-- =====================================================================

create table if not exists public.lpg_customers (
  id         text primary key,
  name       text not null,
  phone      text,
  address    text,
  region     text,              -- gudang/region langganan (opsional)
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_name on public.lpg_customers (name);

-- RLS + grant (anon CRUD seperti tabel operasional lain)
alter table public.lpg_customers enable row level security;
drop policy if exists "anon_all_customers" on public.lpg_customers;
create policy "anon_all_customers" on public.lpg_customers for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.lpg_customers to anon, authenticated;

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='lpg_customers')
      then alter publication supabase_realtime add table public.lpg_customers; end if;
  end if;
end $$;

-- =====================================================================
--  SELESAI ✅
-- =====================================================================
