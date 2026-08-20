-- Add flavour / mg / price rows to the existing products table.
-- Run once in Supabase → SQL Editor, then save again from /admin.html.

alter table public.products
  add column if not exists variants jsonb not null default '[]'::jsonb;
