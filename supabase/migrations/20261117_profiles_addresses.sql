-- ========================================================================
-- SAIS Store — Migration: profiles + addresses
-- Run this in Supabase SQL Editor
-- ========================================================================

-- --------------------------------------------------------
-- 1. PROFILES (id = auth.users.id, role from DB)
-- --------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_phone on profiles(phone);

-- --------------------------------------------------------
-- 2. ADDRESSES (multiple saved addresses per user)
-- --------------------------------------------------------
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Domicile',
  full_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_addresses_user on addresses(user_id);
create index if not exists idx_addresses_default on addresses(user_id, is_default);

-- --------------------------------------------------------
-- 3. RLS
-- --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;

-- Profiles: users read/write only their own; admins read all
create policy "Users can read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "Users can update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()));

create policy "Admins can read all profiles" on public.profiles
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Addresses: users CRUD only their own
create policy "Users can read own addresses" on public.addresses
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users can insert own addresses" on public.addresses
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "Users can update own addresses" on public.addresses
  for update to authenticated using (user_id = (select auth.uid()));

create policy "Users can delete own addresses" on public.addresses
  for delete to authenticated using (user_id = (select auth.uid()));

-- Admin can manage all addresses
create policy "Admins can manage all addresses" on public.addresses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- --------------------------------------------------------
-- 8. Sync existing auth users into profiles (bootstrap)
-- --------------------------------------------------------
-- Insert profiles for existing authenticated users who don't have one yet
insert into public.profiles (id, full_name, phone, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'first_name' || ' ' || u.raw_user_meta_data->>'last_name'),
  u.raw_user_meta_data->>'phone',
  case when (u.raw_user_meta_data->>'role') = 'admin' then 'admin' else 'customer' end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
