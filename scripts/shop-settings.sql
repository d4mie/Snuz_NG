-- Bank account and shipping amounts for /admin.html
-- Run once in Supabase → SQL Editor.
-- Leave the row empty here. Type the real figures on /admin.html, then save.

create table if not exists public.shop_settings (
  id text primary key,
  bank text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  shipping_mode text not null default 'on_delivery'
    check (shipping_mode in ('on_delivery', 'distance', 'varies')),
  shipping_base_naira integer not null default 0 check (shipping_base_naira >= 0),
  shipping_per_km_naira integer not null default 0 check (shipping_per_km_naira >= 0),
  shipping_min_naira integer not null default 0 check (shipping_min_naira >= 0),
  shipping_max_naira integer not null default 0 check (shipping_max_naira >= 0),
  shipping_round_to_naira integer not null default 1 check (shipping_round_to_naira >= 1),
  updated_at timestamptz not null default now()
);

alter table public.shop_settings enable row level security;

drop policy if exists "Public read shop settings" on public.shop_settings;
create policy "Public read shop settings"
  on public.shop_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Anon write shop settings" on public.shop_settings;
create policy "Anon write shop settings"
  on public.shop_settings for all
  to anon, authenticated
  using (true)
  with check (true);
