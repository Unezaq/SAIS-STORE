-- ========================================================================
-- SAIS Store — Supabase Schema
-- Run this in Supabase SQL Editor
-- ========================================================================

-- Enable extensions
create extension if not exists pgcrypto;

-- --------------------------------------------------------
-- 1. PRODUCTS
-- --------------------------------------------------------
create table if not exists products (
  id text primary key default (gen_random_uuid()::text),
  title text not null,
  slug text unique not null,
  slug_category text not null default 'ensembles',
  category_name text not null default 'Ensembles Hiver',
  price integer not null default 0,
  original_price integer,
  image_url text not null,
  colors jsonb default '[]'::jsonb,
  color_images jsonb default '{}'::jsonb,
  sizes jsonb default '[]'::jsonb,
  fabric text,
  features jsonb default '[]'::jsonb,
  badge text,
  ref text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- --------------------------------------------------------
-- 2. LEGACY ADMIN ACCOUNTS (not used for authentication)
-- --------------------------------------------------------
create table if not exists admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- --------------------------------------------------------
-- 3. LEGACY CLIENT ACCOUNTS (not used for authentication)
-- --------------------------------------------------------
create table if not exists client_accounts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  address text,
  created_at timestamptz default now()
);

-- --------------------------------------------------------
-- 4. CLIENTS (profile linked to Supabase Auth)
-- --------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  email text,
  first_name text not null,
  last_name text not null,
  phone text not null,
  address text,
  order_count integer default 0,
  total_spent integer default 0,
  created_at timestamptz default now()
);

-- --------------------------------------------------------
-- 5. ORDERS
-- --------------------------------------------------------
create table if not exists orders (
  id text primary key default ('ord-' || gen_random_uuid()::text),
  auth_user_id uuid references auth.users(id) on delete set null,
  client_email text,
  client_name text,
  customer_name text not null,
  phone text not null,
  address text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal integer not null default 0,
  delivery_fee integer not null default 0,
  total integer not null default 0,
  status text not null default 'en_attente',
  note text,
  created_at timestamptz default now()
);

-- --------------------------------------------------------
-- 6. SETTINGS (singleton store settings)
-- --------------------------------------------------------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'SAIS Store',
  whatsapp_phone text not null default '212600000000',
  delivery_text text not null default 'Livraison 24–48h partout au Maroc',
  payment_text text not null default 'Paiement à la livraison',
  currency text not null default 'MAD',
  delivery_fee integer not null default 22 check (delivery_fee >= 0),
  free_delivery_min_items integer not null default 3 check (free_delivery_min_items >= 0),
  storewide_discount_percent integer not null default 0 check (storewide_discount_percent between 0 and 90),
  discount_start_date date,
  discount_end_date date,
  updated_at timestamptz default now()
);

-- Insert default settings
insert into settings (
  id, store_name, whatsapp_phone, delivery_text, payment_text, currency,
  delivery_fee, free_delivery_min_items, storewide_discount_percent
)
values (
  1, 'SAIS Store', '212644816544', 'Livraison 24–48h partout au Maroc',
  'Paiement à la livraison', 'MAD', 22, 3, 0
)
on conflict (id) do nothing;

-- --------------------------------------------------------
-- Indexes
-- --------------------------------------------------------
create index if not exists idx_products_slug on products(slug);
create index if not exists idx_products_slug_category on products(slug_category);
create index if not exists idx_orders_client_email on orders(client_email);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_clients_email on clients(email);
create unique index if not exists idx_clients_auth_user_id on clients(auth_user_id);
create index if not exists idx_client_accounts_email on client_accounts(email);
create index if not exists idx_admin_accounts_email on admin_accounts(email);
create index if not exists idx_orders_auth_user_id on orders(auth_user_id);

-- --------------------------------------------------------
-- RLS (Row Level Security)
-- --------------------------------------------------------
alter table products enable row level security;
alter table orders enable row level security;
alter table clients enable row level security;
alter table client_accounts enable row level security;
alter table admin_accounts enable row level security;
alter table settings enable row level security;

drop policy if exists "Public read products" on products;
create policy "Public read products" on products
  for select to anon, authenticated using (true);

drop policy if exists "Public read settings" on settings;
create policy "Public read settings" on settings
  for select to anon, authenticated using (true);

drop policy if exists "Users can read own client account" on client_accounts;
drop policy if exists "Users can read own clients profile" on clients;
create policy "Users can read own clients profile" on clients
  for select to authenticated using (auth_user_id = (select auth.uid()));

drop policy if exists "Users can read own orders" on orders;
create policy "Users can read own orders" on orders
  for select to authenticated using (auth_user_id = (select auth.uid()));

drop policy if exists "Admins can manage products" on products;
create policy "Admins can manage products" on products
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage orders" on orders;
create policy "Admins can manage orders" on orders
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage clients" on clients;
create policy "Admins can manage clients" on clients
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage settings" on settings;
create policy "Admins can manage settings" on settings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- client_accounts and admin_accounts intentionally have no client-facing policies.
