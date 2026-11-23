-- ========================================================================
-- SAIS Store — Customer Addresses (multiple addresses per logged-in client)
-- Migration: 20261123_customer_addresses.sql
-- Description: Lets a signed-in customer keep several delivery addresses
-- (domicile, travail, chez un proche…) and pick a default one. RLS makes
-- sure a customer can only see and manage their own addresses.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. CUSTOMER ADDRESSES
-- ------------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Adresse',
  first_name text not null,
  last_name text not null,
  phone text not null,
  city text not null default 'Casablanca',
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_customer_addresses_user on public.customer_addresses(user_id);
create index if not exists idx_customer_addresses_default on public.customer_addresses(user_id, is_default);

-- ------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------
alter table public.customer_addresses enable row level security;

drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses" on public.customer_addresses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Customers read own addresses" on public.customer_addresses;
create policy "Customers read own addresses" on public.customer_addresses
  for select to authenticated
  using (user_id = auth.uid());
