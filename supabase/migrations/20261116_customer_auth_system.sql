-- ========================================================================
-- SAIS Store — Migration: Independent Customer Authentication System
-- Run this in Supabase SQL Editor
--
-- Creates a completely independent customer identity system that does NOT
-- depend on auth.users or Supabase Auth.
--
-- Tables: customers, customer_credentials, customer_sessions
-- Columns added to: orders (customer_id), clients (customer_id)
-- ========================================================================

-- --------------------------------------------------------
-- 1. CUSTOMERS (independent customer identity, no auth.users)
-- --------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  normalized_email text not null,
  phone text not null,
  normalized_phone text not null,
  city text not null,
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_customers_email on public.customers(email);
create unique index if not exists idx_customers_normalized_email on public.customers(normalized_email);
create unique index if not exists idx_customers_phone on public.customers(phone);
create unique index if not exists idx_customers_normalized_phone on public.customers(normalized_phone);
create index if not exists idx_customers_is_active on public.customers(is_active);

-- --------------------------------------------------------
-- 2. CUSTOMER CREDENTIALS (password hashes, never plaintext)
-- --------------------------------------------------------
create table if not exists public.customer_credentials (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  password_hash text not null,
  password_updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create unique index if not exists idx_customer_credentials_customer_id on public.customer_credentials(customer_id);
create index if not exists idx_customer_credentials_password_updated on public.customer_credentials(password_updated_at);

-- --------------------------------------------------------
-- 3. CUSTOMER SESSIONS (server-managed, hashed tokens)
-- --------------------------------------------------------
create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  last_activity_at timestamptz default now(),
  revoked_at timestamptz
);

create index if not exists idx_customer_sessions_customer_id on public.customer_sessions(customer_id);
create index if not exists idx_customer_sessions_token_hash on public.customer_sessions(session_token_hash);
create index if not exists idx_customer_sessions_expires_at on public.customer_sessions(expires_at);
create index if not exists idx_customer_sessions_revoked on public.customer_sessions(revoked_at);

-- --------------------------------------------------------
-- 4. LINK ORDERS TO CUSTOMERS (keep auth_user_id for backward compat)
-- --------------------------------------------------------
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists idx_orders_customer_id on public.orders(customer_id);

-- --------------------------------------------------------
-- 5. LINK CLIENTS TO CUSTOMERS (keep auth_user_id for backward compat)
-- --------------------------------------------------------
alter table public.clients
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists idx_clients_customer_id on public.clients(customer_id);

-- --------------------------------------------------------
-- 6. RLS FOR NEW TABLES
-- --------------------------------------------------------
-- Note: Customer sessions and credentials are accessed via service_role
-- (server-side only). RLS is defense-in-depth. Customers never have a
-- Supabase Auth session, so auth.uid() / auth.jwt() policies do not apply.

alter table public.customers enable row level security;
alter table public.customer_credentials enable row level security;
alter table public.customer_sessions enable row level security;

-- Customers: service_role bypasses RLS. Public/anon can read active customers
-- (needed for order lookup by phone in public tracking).
drop policy if exists "Customers are publicly readable" on public.customers;
create policy "Customers are publicly readable" on public.customers
  for select to anon, authenticated using (is_active = true);

-- No insert/update/delete policies for anon/authenticated on customers.
-- All writes go through service_role server actions.

-- Credentials: never readable by anyone except service_role.
drop policy if exists "Customer credentials are not publicly readable" on public.customer_credentials;
create policy "Customer credentials are not publicly readable" on public.customer_credentials
  for all to anon, authenticated using (false);

-- Sessions: never readable by anyone except service_role.
drop policy if exists "Customer sessions are not publicly readable" on public.customer_sessions;
create policy "Customer sessions are not publicly readable" on public.customer_sessions
  for all to anon, authenticated using (false);

-- --------------------------------------------------------
-- 7. UPDATE ORDERS RLS: customers can read orders by customer_id
-- --------------------------------------------------------
-- Existing policy uses auth_user_id = auth.uid(). New customers won't have
-- auth.uid(). We extend the policy to also match customer_id, but since
-- customer_id is not an auth.users id, this requires the session to carry
-- a custom claim. Instead, server actions use service_role (bypasses RLS)
-- and enforce authorization in application code. RLS stays as defense-in-depth.

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders" on public.orders
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or customer_id = (select auth.uid())
  );

-- --------------------------------------------------------
-- 8. CLEANUP: Remove expired sessions (can be run periodically)
-- --------------------------------------------------------
-- No automatic cleanup in this migration. A server-side job or edge function
-- should delete expired/revoked sessions regularly.
