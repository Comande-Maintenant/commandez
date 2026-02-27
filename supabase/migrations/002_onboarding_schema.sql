-- ==============================================
-- Migration 002: Onboarding + i18n schema
-- Execute in Supabase Dashboard > SQL Editor
-- ==============================================

-- 1. Table owners (auth)
create table if not exists public.owners (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text not null,
  created_at timestamptz default now()
);
alter table public.owners enable row level security;
create policy "owners_self_read" on public.owners for select using (auth.uid() = id);
create policy "owners_self_insert" on public.owners for insert with check (auth.uid() = id);
create policy "owners_self_update" on public.owners for update using (auth.uid() = id);

-- 2. New columns on restaurants
alter table public.restaurants
  add column if not exists owner_id uuid references auth.users(id),
  add column if not exists google_place_id text,
  add column if not exists restaurant_phone text,
  add column if not exists subscription_plan text default 'none',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_start_date timestamptz,
  add column if not exists features jsonb default '{}',
  add column if not exists primary_color text default '#000000',
  add column if not exists bg_color text default '#ffffff',
  add column if not exists payment_methods text[] default '{}',
  add column if not exists website text,
  add column if not exists category_translations jsonb default '{}';

-- 3. New columns on menu_items (variants, tags, translations)
alter table public.menu_items
  add column if not exists variants jsonb default '[]',
  add column if not exists tags text[] default '{}',
  add column if not exists translations jsonb default '{}';

-- 4. Index for owner lookup
create index if not exists idx_restaurants_owner_id on public.restaurants(owner_id);

-- 5. Storage bucket for menu uploads
insert into storage.buckets (id, name, public)
values ('menu-uploads', 'menu-uploads', true)
on conflict (id) do nothing;

-- Allow public uploads to menu-uploads bucket
create policy "public_menu_upload" on storage.objects
  for insert with check (bucket_id = 'menu-uploads');
create policy "public_menu_read" on storage.objects
  for select using (bucket_id = 'menu-uploads');
