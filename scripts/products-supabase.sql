-- snuz.ng product catalog (run once in Supabase → SQL Editor)
--
-- After this:
-- 1. Project Settings → API → copy Project URL + anon public key
-- 2. Put them in shop-config.local.js (local) and GitHub Actions secrets (live):
--      SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD
-- 3. Open /admin.html → unlock → edit products
--
-- Soft security note: writes use the anon key; /admin.html password is the gate.
-- Fine for a small private admin. Tighten later with a server route if needed.

-- ---------------------------------------------------------------------------
-- Products table
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  slug text primary key,
  brand text not null default '',
  title text not null default '',
  price_naira integer not null default 0 check (price_naira >= 0),
  image_url text not null default '',
  available boolean not null default true,
  sort_order integer not null default 0,
  variants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists products_sort_order_idx on public.products (sort_order);

-- Seed current collections (safe to re-run)
insert into public.products (slug, brand, title, price_naira, image_url, available, sort_order) values
  ('pablo',   'PABLO',   'Pablo Blue Mint',         9500, './assets/pablo-bluemint.jpg',         false, 10),
  ('zafari',  'ZAFARI',  'Zafari Cool Mint',        9500, './assets/zafari-coolmint.jpg',        true,  20),
  ('zyn',     'ZYN',     'Zyn Fresh Mint',          9500, './assets/zyn-freshmint.jpg',          false, 30),
  ('iceberg', 'ICEBERG', 'Iceberg Watermelon',      9500, './assets/iceberg-watermelon.jpg',     false, 40),
  ('velo',    'VELO',    'Velo Bright Spearmint',   9500, './assets/velo-brightspearmint.jpg',   false, 50),
  ('maggie',  'MAGGIE',  'Maggie Cherry Tonic',      100, './assets/maggie-cherrytonic.jpg',     false, 60)
on conflict (slug) do nothing;

-- If an older product_stock table exists, copy availability into products
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_stock'
  ) then
    update public.products p
    set available = s.available,
        updated_at = now()
    from public.product_stock s
    where p.slug = s.slug;
  end if;
end $$;

alter table public.products enable row level security;

drop policy if exists "Public read products" on public.products;
create policy "Public read products"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "Anon write products" on public.products;
create policy "Anon write products"
  on public.products for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Image storage (product photos uploaded from /admin.html)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Anon upload product images" on storage.objects;
create policy "Anon upload product images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Anon update product images" on storage.objects;
create policy "Anon update product images"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Anon delete product images" on storage.objects;
create policy "Anon delete product images"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'product-images');
