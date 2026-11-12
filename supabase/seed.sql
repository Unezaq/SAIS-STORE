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
-- 2. ADMIN ACCOUNTS (email + password hash)
-- --------------------------------------------------------
create table if not exists admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- --------------------------------------------------------
-- 3. CLIENT ACCOUNTS (email + password hash)
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
-- 4. CLIENTS (public profile, linked to client_accounts)
-- --------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
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
  client_email text,
  client_name text,
  customer_name text not null,
  phone text not null,
  address text not null,
  items jsonb not null default '[]'::jsonb,
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
  updated_at timestamptz default now()
);

-- Insert default settings
insert into settings (id, store_name, whatsapp_phone, delivery_text, payment_text, currency)
values (1, 'SAIS Store', '212600000000', 'Livraison 24–48h partout au Maroc', 'Paiement à la livraison', 'MAD')
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
create index if not exists idx_client_accounts_email on client_accounts(email);
create index if not exists idx_admin_accounts_email on admin_accounts(email);

-- --------------------------------------------------------
-- RLS (Row Level Security) — public read, authenticated write
-- --------------------------------------------------------
alter table products enable row level security;
alter table orders enable row level security;
alter table clients enable row level security;
alter table client_accounts enable row level security;
alter table admin_accounts enable row level security;
alter table settings enable row level security;

-- Public can read products, settings, categories
create policy "Public read products" on products for select using (true);
create policy "Public read settings" on settings for select using (true);

-- Authenticated users can manage their own data
create policy "Users can read own client account" on client_accounts for select using (auth.uid() = id);
create policy "Users can read own clients profile" on clients for select using (auth.uid() = id);
create policy "Users can read own orders" on orders for select using (auth.uid() = id);

-- Service role / admin can do everything (bypassed via service key in server actions)
