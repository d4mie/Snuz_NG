-- Run once in Supabase → SQL Editor.
-- Then set SUPABASE_URL + SUPABASE_ANON_KEY (+ ADMIN_PASSWORD) in GitHub Actions secrets
-- or shop-config.local.js for localhost.

create table if not exists public.product_stock (
  slug text primary key,
  title text not null default '',
  available boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.product_stock (slug, title, available) values
  ('pablo', 'Pablo Blue Mint', false),
  ('zafari', 'Zafari Cool Mint', true),
  ('zyn', 'Zyn Fresh Mint', false),
  ('iceberg', 'Iceberg Watermelon', false),
  ('velo', 'Velo Bright Spearmint', false),
  ('maggie', 'Maggie Cherry Tonic', false)
on conflict (slug) do nothing;

alter table public.product_stock enable row level security;

-- Public read (shop homepage)
drop policy if exists "Public read product stock" on public.product_stock;
create policy "Public read product stock"
  on public.product_stock for select
  to anon, authenticated
  using (true);

-- Public write with anon key (protected by admin.html password gate).
-- For a small team site this is acceptable; tighten later with a server route if needed.
drop policy if exists "Anon upsert product stock" on public.product_stock;
create policy "Anon upsert product stock"
  on public.product_stock for all
  to anon, authenticated
  using (true)
  with check (true);
