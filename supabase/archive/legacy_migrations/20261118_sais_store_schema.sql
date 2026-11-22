-- ========================================================================
-- SAIS Store — Consolidated schema (idempotent)
-- Replaces all earlier migrations (01_sais_store_schema, 20261113_*, ...,
-- 20261117_*). Safe to re-run: uses IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION and DROP POLICY IF EXISTS + CREATE POLICY.
-- Demo/live data lives in seed.sql (INSERTs only).
-- ========================================================================

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- --------------------------------------------------------
-- 1. settings (singleton store configuration)
-- --------------------------------------------------------
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'SAIS Store',
  whatsapp_phone text not null default '212644816544',
  delivery_text text not null default 'Livraison 24–48h partout au Maroc',
  payment_text text not null default 'Paiement à la livraison',
  currency text not null default 'MAD',
  delivery_fee numeric(10,2) not null default 22.00 check (delivery_fee >= 0),
  free_delivery_min_items integer not null default 3 check (free_delivery_min_items >= 0),
  storewide_discount_percent numeric(5,2) not null default 0.00 check (storewide_discount_percent between 0 and 90),
  discount_start_date timestamptz,
  discount_end_date timestamptz,
  updated_at timestamptz default now()
);

insert into public.settings (
  id, store_name, whatsapp_phone, delivery_text, payment_text, currency,
  delivery_fee, free_delivery_min_items, storewide_discount_percent
) values (
  1, 'SAIS Store', '212644816544', 'Livraison 24–48h partout au Maroc',
  'Paiement à la livraison', 'MAD', 22.00, 3, 0.00
) on conflict (id) do nothing;

-- --------------------------------------------------------
-- 2. products
--    id = uuid (matches code + product_variants FK).
--    colors = jsonb (code stores [{name, hex}]).
--    sizes/features = text[] (code stores string[]).
-- --------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  slug_category text not null default 'ensembles',
  category_name text not null default 'Ensembles Hiver',
  price numeric(10,2) not null default 0.00 check (price >= 0),
  original_price numeric(10,2) check (original_price is null or original_price >= 0),
  image_url text not null,
  colors jsonb default '[]'::jsonb,
  color_images jsonb default '{}'::jsonb,
  sizes text[] default array['S','M','L','XL']::text[],
  fabric text,
  features text[] default array[]::text[],
  badge text,
  ref text,
  description text,
  is_active boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_slug_category on public.products(slug_category);
create index if not exists idx_products_active on public.products(is_active);

-- --------------------------------------------------------
-- 3. profiles (extends auth.users; role is the admin source of truth)
-- --------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_phone on public.profiles(phone);

-- --------------------------------------------------------
-- 4. addresses (saved addresses per auth user)
-- --------------------------------------------------------
create table if not exists public.addresses (
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
create index if not exists idx_addresses_user on public.addresses(user_id);
create index if not exists idx_addresses_default on public.addresses(user_id, is_default);

-- --------------------------------------------------------
-- 5. customers (independent identity, NO auth.users dependency)
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
-- 6. customer_credentials
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
-- 7. customer_sessions
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
-- 8. orders
--    id = text ('ord-...'). idempotency_key + order_number + tracking_token added.
--    discount_total added (code writes it). city kept w/ default for RPC compat.
-- --------------------------------------------------------
create table if not exists public.orders (
  id text primary key default ('ord-' || substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  auth_user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  client_email text,
  client_name text,
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0.00 check (subtotal >= 0),
  discount_total numeric(10,2) not null default 0.00 check (discount_total >= 0),
  delivery_fee numeric(10,2) not null default 0.00 check (delivery_fee >= 0),
  total numeric(10,2) not null default 0.00 check (total >= 0),
  status text not null default 'en_attente',
  note text,
  tracking_token text unique,
  order_number text,
  idempotency_key text unique,
  created_at timestamptz default now()
);

create index if not exists idx_orders_auth_user_id on public.orders(auth_user_id);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_tracking_token on public.orders(tracking_token);
create index if not exists idx_orders_idempotency_key on public.orders(idempotency_key);

-- --------------------------------------------------------
-- 9. product_variants
-- --------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  price_adjustment integer not null default 0,
  sku text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (product_id, size, color)
);
create index if not exists idx_product_variants_product on public.product_variants(product_id);
create index if not exists idx_product_variants_stock on public.product_variants(stock);

-- --------------------------------------------------------
-- 10. order_items (price snapshot per line)
-- --------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant text,
  name_snapshot text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity >= 1),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz default now()
);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- --------------------------------------------------------
-- 11. order_status_history
-- --------------------------------------------------------
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_order_status_history_order on public.order_status_history(order_id);

-- --------------------------------------------------------
-- 12. coupons
-- --------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percentage','fixed')),
  value integer not null check (value > 0),
  min_order integer not null default 0 check (min_order >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0 check (used_count >= 0),
  per_user_limit integer,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_is_active on public.coupons(is_active);

-- --------------------------------------------------------
-- 13. legacy clients (guest profiles linked to Supabase Auth) — kept, code reads it
-- --------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  email text,
  first_name text not null,
  last_name text not null,
  phone text not null,
  address text,
  order_count integer default 0,
  total_spent integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_clients_email on public.clients(email);
create unique index if not exists idx_clients_auth_user_id on public.clients(auth_user_id);
create index if not exists idx_clients_customer_id on public.clients(customer_id);

-- --------------------------------------------------------
-- 13b. Existing-database safety (idempotent)
--     Additive columns / type adjustments for tables that may predate this
--     migration. Safe to re-run.
--
--     IMPORTANT: products.id text -> uuid CANNOT be altered in place if rows
--     exist (and product_variants.product_id FK depends on it). On an existing
--     project whose products.id is still text, apply a fresh project or a
--     dedicated data migration first. All other columns below are additive or
--     safely castable.
-- --------------------------------------------------------

-- orders: additive columns (idempotent)
alter table public.orders add column if not exists discount_total numeric(10,2) not null default 0.00;
alter table public.orders add column if not exists delivery_fee numeric(10,2) not null default 0.00;
alter table public.orders add column if not exists tracking_token text;
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists city text;

-- unique constraints on added columns (only if not already present)
create unique index if not exists idx_orders_tracking_token on public.orders(tracking_token);
create unique index if not exists idx_orders_idempotency_key on public.orders(idempotency_key);

-- backfill legacy city (unknown -> store's city, Kenitra), then enforce
-- NOT NULL without any default. Checkout now must supply city.
update public.orders set city = 'Kenitra' where city is null;
alter table public.orders alter column city drop default;
alter table public.orders alter column city set not null;

-- order_items: ensure it exists with price-snapshot columns (additive)
alter table public.order_items add column if not exists unit_price integer not null default 0 check (unit_price >= 0);
alter table public.order_items add column if not exists line_total integer not null default 0 check (line_total >= 0);

-- coupons: ensure columns exist (additive)
alter table public.coupons add column if not exists min_order integer not null default 0 check (min_order >= 0);
alter table public.coupons add column if not exists max_uses integer;
alter table public.coupons add column if not exists per_user_limit integer;
alter table public.coupons add column if not exists used_count integer not null default 0 check (used_count >= 0);

-- settings: ensure numeric fee columns (no type change on existing integer
-- columns here; document that a fresh project gives clean numeric types).
alter table public.settings add column if not exists discount_start_date timestamptz;
alter table public.settings add column if not exists discount_end_date timestamptz;

-- --------------------------------------------------------
-- 13c. Admin helper function (is_admin)
--     SECURITY DEFINER so it can read public.profiles even when RLS
--     would block the calling user. STABLE: same result within a session.
--     Admin = app_metadata.role='admin' OR profiles.role='admin' (id = auth.uid()).
-- --------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return true;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
end;
$$;

-- --------------------------------------------------------
-- 14. RLS on every table
--     Admin = public.is_admin()  (profiles.role='admin' OR app_metadata.role='admin')
--     (bridge: admin login sets app_metadata; profiles.role is the source of truth)
-- --------------------------------------------------------
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.clients enable row level security;
alter table public.customers enable row level security;
alter table public.customer_credentials enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.product_variants enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.coupons enable row level security;

-- Admin check helper is defined below as public.is_admin()
-- (SECURITY DEFINER, STABLE, search_path = public). Used in all policies.

-- settings: public read; admin all
drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings
  for select to public using (true);
drop policy if exists "Admin manage settings" on public.settings;
create policy "Admin manage settings" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- products: public read ACTIVE only; admin all
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products
  for select to public using (is_active = true);
drop policy if exists "Admin manage products" on public.products;
create policy "Admin manage products" on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- product_variants: public read; admin all
drop policy if exists "Public read product variants" on public.product_variants;
create policy "Public read product variants" on public.product_variants
  for select to public using (true);
drop policy if exists "Admin manage product variants" on public.product_variants;
create policy "Admin manage product variants" on public.product_variants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- profiles: users own; admin read all
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (role <> 'admin' or public.is_admin());
drop policy if exists "Admin read all profiles" on public.profiles;
create policy "Admin read all profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- addresses: users CRUD own; admin all
drop policy if exists "Users read own addresses" on public.addresses;
create policy "Users read own addresses" on public.addresses
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users insert own addresses" on public.addresses;
create policy "Users insert own addresses" on public.addresses
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update own addresses" on public.addresses;
create policy "Users update own addresses" on public.addresses
  for update to authenticated using (user_id = auth.uid());
drop policy if exists "Users delete own addresses" on public.addresses;
create policy "Users delete own addresses" on public.addresses
  for delete to authenticated using (user_id = auth.uid());
drop policy if exists "Admin manage addresses" on public.addresses;
create policy "Admin manage addresses" on public.addresses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- clients: guest profiles — owner (auth_user_id) read; admin all. No public select.
drop policy if exists "Users read own client profile" on public.clients;
create policy "Users read own client profile" on public.clients
  for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists "Admin manage clients" on public.clients;
create policy "Admin manage clients" on public.clients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- customers / credentials / sessions: NOT publicly readable.
-- Independent customer auth is mediated by server actions (service_role). RLS is
-- defense-in-depth: no anon/authenticated select policy → public sees nothing.
-- (No policy created here = nothing selectable except service_role bypass.)

-- orders: NO public INSERT. Orders are created only through place_order_rpc
-- (SECURITY DEFINER, invoked server-side via service_role). RLS INSERT on
-- orders/order_items is intentionally absent for anon/authenticated so a
-- browser with the anon key cannot bypass stock, coupon and price validation.
drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Users or admins read orders" on public.orders;
create policy "Users or admins read orders" on public.orders
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- order_items: order owner (auth_user_id) or admin only. Not publicly selectable.
drop policy if exists "Users read own order items" on public.order_items;
create policy "Users read own order items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.auth_user_id = auth.uid()
  ));
drop policy if exists "Admin manage order items" on public.order_items;
create policy "Admin manage order items" on public.order_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- order_status_history: order owner or admin only. Not publicly selectable.
drop policy if exists "Users read own order status history" on public.order_status_history;
create policy "Users read own order status history" on public.order_status_history
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and o.auth_user_id = auth.uid()
  ));
drop policy if exists "Admin manage order status history" on public.order_status_history;
create policy "Admin manage order status history" on public.order_status_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- coupons: NOT publicly selectable (validated only via SECURITY DEFINER RPC).
drop policy if exists "Coupons are not publicly readable" on public.coupons;
create policy "Coupons are not publicly readable" on public.coupons
  for all to authenticated using (false);
drop policy if exists "Admin manage coupons" on public.coupons;
create policy "Admin manage coupons" on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --------------------------------------------------------
-- 15. RPCs (fixed search_path; SECURITY DEFINER where server-side only)
-- --------------------------------------------------------
create or replace function public.normalize_moroccan_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text;
  v_local text;
begin
  v_digits := regexp_replace(p_value, '[\s().-]', '', 'g');
  if v_digits like '+%' then
    v_digits := substring(v_digits from 2);
  elsif v_digits like '00%' then
    v_digits := substring(v_digits from 3);
  end if;

  if v_digits like '212%' then
    v_local := substring(v_digits from 4);
  else
    v_local := v_digits;
  end if;

  if v_local like '0%' then
    v_local := substring(v_local from 2);
  end if;

  if v_local ~ '^[5-7]\d{8}$' then
    return '+212' || v_local;
  end if;
  return null;
end;
$$;

create or replace function public.validate_coupon(p_code text, p_subtotal integer)
returns table (valid boolean, discount_amount integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
  v_discount integer;
begin
  select * into v_coupon
  from public.coupons
  where code = lower(p_code)
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
    and (max_uses is null or used_count < max_uses)
  limit 1;

  if not found then
    return query select false, 0, 'Ce code de réduction n’existe pas ou n’est plus valide.';
  end if;

  if p_subtotal < v_coupon.min_order then
    return query select false, 0, 'Ce code s’applique uniquement à partir de ' || v_coupon.min_order || ' MAD.';
  end if;

  if v_coupon.type = 'percentage' then
    v_discount := floor(p_subtotal * v_coupon.value / 100.0);
  else
    v_discount := v_coupon.value;
  end if;

  if v_discount > p_subtotal then
    v_discount := p_subtotal;
  end if;

  return query select true, v_discount, 'Réduction appliquée.';
end;
$$;

create or replace function public.order_reference_for_tracking(p_order_id text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_id text;
begin
  select id into v_id from public.orders where id = p_order_id;
  return 'SAIS-' || upper(right(replace(v_id, '-', ''), 8));
end;
$$;

create or replace function public.get_order_for_tracking(p_order_number text, p_phone text)
returns table (
  order_id text,
  order_number text,
  tracking_token text,
  status text,
  created_at timestamptz,
  total numeric(10,2),
  subtotal numeric(10,2),
  delivery_fee numeric(10,2),
  customer_name text,
  phone text,
  address text,
  note text,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_moroccan_phone(p_phone);
begin
  if v_phone is null then
    return;
  end if;

  return query
  select
    o.id,
    'SAIS-' || upper(right(replace(o.id, '-', ''), 8)) as order_number,
    o.tracking_token,
    o.status,
    o.created_at,
    o.total,
    o.subtotal,
    o.delivery_fee,
    o.customer_name,
    o.phone,
    o.address,
    o.note,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', p.slug,
          'title', oi.name_snapshot,
          'color', nullif(oi.variant, ''),
          'size', null,
          'quantity', oi.quantity,
          'price', oi.unit_price,
          'image_url', p.image_url
        )
      )
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb) as items
  from public.orders o
  where o.phone = v_phone
    and (
      o.id = p_order_number
      or 'SAIS-' || upper(right(replace(o.id, '-', ''), 8)) = p_order_number
      or o.tracking_token = p_order_number
    )
  limit 1;
end;
$$;

create or replace function public.place_order_rpc(
  p_auth_user_id uuid,
  p_customer_id uuid,
  p_client_email text,
  p_client_name text,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_items jsonb,
  p_note text,
  p_coupon_code text,
  p_idempotency_key text
)
returns table (
  order_id text,
  order_number text,
  tracking_token text,
  subtotal numeric(10,2),
  discount_total numeric(10,2),
  delivery_fee numeric(10,2),
  total numeric(10,2),
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_subtotal numeric(10,2) := 0;
  v_discount_total numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_order_id text;
  v_tracking_token text;
  v_order_number text;
  v_status text;
  v_item record;
  v_product record;
  v_variant record;
  v_unit_price numeric(10,2);
  v_base_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_quantity integer;
  v_variant_stock integer;
  v_total_items integer := 0;
  v_storewide_active boolean := false;
  v_coupon_valid boolean := false;
  v_coupon_message text := '';
  i integer;
begin
  -- Idempotency: dedicated column (not order id / tracking token).
  if p_idempotency_key is not null then
    select id, order_reference_for_tracking(id), tracking_token, subtotal, discount_total, delivery_fee, total, status
    into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status
    from public.orders
    where idempotency_key = p_idempotency_key;

    if found then
      return query select v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status;
    end if;
  end if;

  -- Settings
  select * into v_settings from public.settings where id = 1;

  -- Storewide promotion: same rule as lib/pricing.ts getStorePrice()
  v_storewide_active :=
    coalesce(v_settings.storewide_discount_percent, 0) > 0
    and v_settings.discount_start_date is not null
    and v_settings.discount_end_date is not null
    and (now() at time zone 'Africa/Casablanca')::date
        between v_settings.discount_start_date and v_settings.discount_end_date;

  -- Validate items, check stock (incl. variants), compute subtotal
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;
    if not found then
      raise exception 'Produit introuvable : %', v_item.elem->>'slug';
    end if;

    v_item_quantity := (v_item.elem->>'quantity')::integer;

    -- Base price: storewide discount excludes products already on sale
    v_base_price := v_product.price;
    if v_storewide_active
      and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_base_price := greatest(
        1,
        round(v_product.price * (100 - v_settings.storewide_discount_percent) / 100.0)::numeric(10,2)
      );
    end if;

    -- Find variant if size/color specified
    v_variant_stock := null;
    if (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null then
      select * into v_variant
      from public.product_variants
      where product_id = v_product.id
        and (v_item.elem->>'size') is not distinct from size
        and (v_item.elem->>'color') is not distinct from color
      limit 1;

      if not found then
        raise exception 'Variante introuvable pour %', v_product.title;
      end if;

      v_variant_stock := v_variant.stock;
      if v_variant_stock < v_item_quantity then
        raise exception 'Stock insuffisant pour % (% restant)', v_product.title, v_variant_stock;
      end if;

      v_unit_price := v_base_price + coalesce(v_variant.price_adjustment, 0);
    else
      -- Legacy: use product stock
      if v_product.stock < v_item_quantity then
        raise exception 'Stock insuffisant pour % (% restant)', v_product.title, v_product.stock;
      end if;

      v_unit_price := v_base_price;
    end if;

    v_line_total := v_unit_price * v_item_quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- Apply coupon (authoritative)
  if p_coupon_code is not null and p_coupon_code <> '' then
    select valid, discount_amount, message
    into v_coupon_valid, v_discount_total, v_coupon_message
    from public.validate_coupon(p_coupon_code, v_subtotal);

    if not v_coupon_valid then
      raise exception 'Coupon invalide : %', v_coupon_message;
    end if;
  end if;

  -- Delivery fee
  if v_settings.free_delivery_min_items > 0 then
    select sum((elem->>'quantity')::integer) into v_total_items
    from jsonb_array_elements(p_items) as elem;
    if v_total_items >= v_settings.free_delivery_min_items then
      v_delivery_fee := 0;
    else
      v_delivery_fee := v_settings.delivery_fee;
    end if;
  else
    v_delivery_fee := v_settings.delivery_fee;
  end if;

  v_total := v_subtotal - v_discount_total + v_delivery_fee;
  if v_total < 0 then v_total := 0; end if;

  -- Tracking token + order number
  v_tracking_token := gen_random_uuid()::text;

  -- Insert order (customer_id atomic; idempotency_key stored)
  insert into public.orders (
    auth_user_id, customer_id, client_email, client_name, customer_name,
    phone, address, city, items, subtotal, discount_total, delivery_fee, total,
    status, note, tracking_token, order_number, idempotency_key
  )
  values (
    p_auth_user_id,
    p_customer_id,
    p_client_email,
    p_client_name,
    p_customer_name,
    p_phone,
    p_address,
    p_city,
    p_items,
    v_subtotal,
    v_discount_total,
    v_delivery_fee,
    v_total,
    'en_attente',
    p_note,
    v_tracking_token,
    null,
    p_idempotency_key
  )
  returning id, tracking_token into v_order_id, v_tracking_token;

  select 'SAIS-' || upper(right(replace(v_order_id, '-', ''), 8)) into v_order_number;

  update public.orders set order_number = v_order_number where id = v_order_id;

  -- Insert order items + decrement stock + increment coupon usage
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;

    v_item_quantity := (v_item.elem->>'quantity')::integer;
    v_variant_stock := null;

    v_base_price := v_product.price;
    if v_storewide_active
      and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_base_price := greatest(
        1,
        round(v_product.price * (100 - v_settings.storewide_discount_percent) / 100.0)::numeric(10,2)
      );
    end if;

    if (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null then
      select * into v_variant
      from public.product_variants
      where product_id = v_product.id
        and (v_item.elem->>'size') is not distinct from size
        and (v_item.elem->>'color') is not distinct from color
      limit 1;

      v_unit_price := v_base_price + coalesce(v_variant.price_adjustment, 0);
    else
      v_unit_price := v_base_price;
    end if;

    v_line_total := v_unit_price * v_item_quantity;

    insert into public.order_items (
      order_id, product_id, variant, name_snapshot, unit_price, quantity, line_total
    )
    values (
      v_order_id,
      v_product.id,
      case
        when (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null
        then (v_item.elem->>'size') || ' · ' || (v_item.elem->>'color')
        else null
      end,
      v_product.title,
      v_unit_price,
      v_item_quantity,
      v_line_total
    );

    -- Decrement stock
    if (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null then
      update public.product_variants
      set stock = stock - v_item_quantity, updated_at = now()
      where id = v_variant.id;
    else
      update public.products
      set stock = stock - v_item_quantity, updated_at = now()
      where id = v_product.id;
    end if;
  end loop;

  -- Increment coupon usage
  if p_coupon_code is not null and p_coupon_code <> '' then
    update public.coupons
    set used_count = used_count + 1
    where code = lower(p_coupon_code);
  end if;

  -- Initial status history
  insert into public.order_status_history (order_id, status, note)
  values (v_order_id, 'en_attente', 'Commande créée');

  return query select
    v_order_id as order_id,
    v_order_number as order_number,
    v_tracking_token as tracking_token,
    v_subtotal as subtotal,
    v_discount_total as discount_total,
    v_delivery_fee as delivery_fee,
    v_total as total,
    'en_attente' as status;
end;
$$;

-- place_order_rpc, get_order_for_tracking and order_reference_for_tracking
-- are invoked only server-side (createAdminClient → service_role).
-- Revoke direct execution from anon / authenticated / public.
revoke execute on function public.place_order_rpc(
  uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text
) from anon, authenticated, public;
revoke execute on function public.get_order_for_tracking(text, text)
  from anon, authenticated, public;
revoke execute on function public.order_reference_for_tracking(text)
  from anon, authenticated, public;

-- validate_coupon is read-only and is invoked via the SSR client (anon-capable
-- during guest checkout). Kept executable so Phase-1 actions keep working.
-- Review: move checkout to service_role, then revoke here too.

-- --------------------------------------------------------
-- 16. Data migration (idempotent)
--     - backfill order_number / tracking_token on legacy orders
--     - migrate JSONB orders.items -> order_items rows (price snapshot)
-- --------------------------------------------------------
update public.orders
set order_number = 'SAIS-' || upper(right(replace(id, '-', ''), 8))
where order_number is null;

update public.orders
set tracking_token = gen_random_uuid()::text
where tracking_token is null;

insert into public.order_items (order_id, product_id, variant, name_snapshot, unit_price, quantity, line_total, created_at)
select
  o.id,
  p.id,
  case
    when (oi.elem->>'size') is not null or (oi.elem->>'color') is not null
    then (oi.elem->>'size') || ' · ' || (oi.elem->>'color')
    else null
  end,
  p.title,
  p.price::integer,
  (oi.elem->>'quantity')::integer,
  (p.price::integer * (oi.elem->>'quantity')::integer),
  o.created_at
from public.orders o
cross join lateral jsonb_array_elements(o.items) as oi(elem)
join public.products p on p.slug = oi.elem->>'slug'
where not exists (
  select 1 from public.order_items oi2 where oi2.order_id = o.id
);

-- ========================================================================
-- End of consolidated migration
-- ========================================================================
