-- ========================================================================
-- SAIS Store — Canonical Production Schema Migration
-- Migration: 20261122_sais_store_production.sql
-- Description: Clean, hardened, unified database architecture for SAIS STORE.
-- Safe for new project bootstrap or re-run on existing databases.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------
-- 2. SETTINGS (Store Configuration Singleton)
-- ------------------------------------------------------------------------
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
  discount_start_date date,
  discount_end_date date,
  updated_at timestamptz default now()
);

-- Seed singleton row if absent
insert into public.settings (
  id, store_name, whatsapp_phone, delivery_text, payment_text, currency,
  delivery_fee, free_delivery_min_items, storewide_discount_percent
) values (
  1, 'SAIS Store', '212644816544', 'Livraison 24–48h partout au Maroc',
  'Paiement à la livraison', 'MAD', 22.00, 3, 0.00
) on conflict (id) do nothing;

-- ------------------------------------------------------------------------
-- 3. PRODUCTS (Master Garment Catalog)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 4. PRODUCT VARIANTS (Size / Color Specific Inventory)
-- ------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  price_adjustment numeric(10,2) not null default 0.00,
  sku text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (product_id, size, color)
);

create index if not exists idx_product_variants_product on public.product_variants(product_id);
create index if not exists idx_product_variants_stock on public.product_variants(stock);

-- ------------------------------------------------------------------------
-- 5. PROFILES (Extends auth.users for Administrators)
-- ------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

-- ------------------------------------------------------------------------
-- 6. CLIENTS (Customer CRM Directory aggregated by Phone)
-- ------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  first_name text not null,
  last_name text not null,
  email text,
  city text not null default 'Casablanca',
  address text,
  order_count integer not null default 0 check (order_count >= 0),
  total_spent numeric(10,2) not null default 0.00 check (total_spent >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_clients_phone_unique on public.clients(phone);

-- ------------------------------------------------------------------------
-- 7. COUPONS (Discounts & Promo Codes)
-- ------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percentage','fixed')),
  value numeric(10,2) not null check (value > 0),
  min_order numeric(10,2) not null default 0.00 check (min_order >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  per_user_limit integer,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_is_active on public.coupons(is_active);

-- ------------------------------------------------------------------------
-- 8. ORDERS (Purchase Orders)
-- ------------------------------------------------------------------------
create table if not exists public.orders (
  id text primary key default ('ord-' || substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  order_number text unique not null,
  tracking_token text unique not null default replace(gen_random_uuid()::text,'-',''),
  idempotency_key text unique,
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  client_email text,
  client_name text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0.00 check (subtotal >= 0),
  discount_total numeric(10,2) not null default 0.00 check (discount_total >= 0),
  delivery_fee numeric(10,2) not null default 0.00 check (delivery_fee >= 0),
  total numeric(10,2) not null default 0.00 check (total >= 0),
  status text not null default 'en_attente' check (status in ('en_attente','confirmee','expediee','livree','annulee')),
  payment_method text not null default 'cod',
  payment_status text not null default 'unpaid',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_orders_phone on public.orders(phone);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_tracking_token on public.orders(tracking_token);
create index if not exists idx_orders_idempotency_key on public.orders(idempotency_key);

-- ------------------------------------------------------------------------
-- 9. ORDER ITEMS (Immutable Price Snapshots)
-- ------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant text,
  name_snapshot text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity >= 1),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- ------------------------------------------------------------------------
-- 10. ORDER STATUS HISTORY (Timeline State Transitions)
-- ------------------------------------------------------------------------
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null check (status in ('en_attente','confirmee','expediee','livree','annulee')),
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_order_status_history_order on public.order_status_history(order_id);

-- ------------------------------------------------------------------------
-- 11. DATABASE FUNCTIONS
-- ------------------------------------------------------------------------

-- 11.1 Admin verification helper
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

-- 11.2 Moroccan phone normalization (+212XXXXXXXXX)
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
  if p_value is null then
    return null;
  end if;

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

-- 11.3 Generate readable order reference
create or replace function public.order_reference_for_tracking(p_order_id text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_id text;
begin
  select id into v_id from public.orders where id = p_order_id;
  if not found then
    return 'SAIS-' || upper(right(replace(p_order_id, '-', ''), 8));
  end if;
  return 'SAIS-' || upper(right(replace(v_id, '-', ''), 8));
end;
$$;

-- 11.4 Atomic Coupon Validation
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (valid boolean, discount_amount numeric(10,2), message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
  v_discount numeric(10,2);
begin
  select * into v_coupon
  from public.coupons
  where code = lower(trim(p_code))
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
    and (max_uses is null or used_count < max_uses)
  limit 1;

  if not found then
    return query select false, 0.00::numeric(10,2), 'Ce code de réduction n’existe pas ou n’est plus valide.'::text;
    return;
  end if;

  if p_subtotal < v_coupon.min_order then
    return query select false, 0.00::numeric(10,2), ('Ce code s’applique uniquement à partir de ' || v_coupon.min_order || ' MAD.')::text;
    return;
  end if;

  if v_coupon.type = 'percentage' then
    v_discount := floor(p_subtotal * v_coupon.value / 100.0)::numeric(10,2);
  else
    v_discount := v_coupon.value::numeric(10,2);
  end if;

  if v_discount > p_subtotal then
    v_discount := p_subtotal;
  end if;

  return query select true, v_discount, 'Réduction appliquée.'::text;
end;
$$;

-- 11.5 Public Order Tracking via Phone + Reference
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
    o.order_number,
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
          'color', oi.variant,
          'size', null,
          'quantity', oi.quantity,
          'price', oi.unit_price,
          'image_url', p.image_url
        )
      )
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = o.id
    ), o.items) as items
  from public.orders o
  where o.phone = v_phone
    and (
      o.id = p_order_number
      or o.order_number = upper(trim(p_order_number))
      or o.tracking_token = p_order_number
    )
  limit 1;
end;
$$;

-- 11.6 ATOMIC ORDER PLACEMENT (place_order_rpc)
-- Executes in a single transactional unit with pessimistic row locking.
create or replace function public.place_order_rpc(
  p_auth_user_id uuid default null,
  p_customer_id uuid default null,
  p_client_email text default null,
  p_client_name text default null,
  p_customer_name text default '',
  p_phone text default '',
  p_address text default '',
  p_city text default 'Casablanca',
  p_items jsonb default '[]'::jsonb,
  p_note text default null,
  p_coupon_code text default null,
  p_idempotency_key text default null
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
  v_subtotal numeric(10,2) := 0.00;
  v_discount_total numeric(10,2) := 0.00;
  v_delivery_fee numeric(10,2) := 0.00;
  v_total numeric(10,2) := 0.00;
  v_order_id text;
  v_tracking_token text;
  v_order_number text;
  v_status text := 'en_attente';
  v_item record;
  v_product record;
  v_variant record;
  v_unit_price numeric(10,2);
  v_base_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_quantity integer;
  v_total_items integer := 0;
  v_storewide_active boolean := false;
  v_coupon_valid boolean := false;
  v_coupon_message text := '';
  v_phone text;
  v_customer_name text;
  v_first_name text;
  v_last_name text;
  i integer;
  v_slugs text[];
begin
  -- 1. Input sanitization
  v_customer_name := trim(coalesce(p_customer_name, p_client_name, ''));
  if length(v_customer_name) < 2 then
    raise exception 'Nom du client requis (minimum 2 caractères).';
  end if;

  v_phone := public.normalize_moroccan_phone(p_phone);
  if v_phone is null then
    raise exception 'Numéro de téléphone marocain invalide (+212...)';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier ne peut pas être vide.';
  end if;

  -- 2. Idempotency Check: if key already exists, return previous order without changes
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select id, order_number, tracking_token, subtotal, discount_total, delivery_fee, total, status
    into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status
    from public.orders
    where idempotency_key = trim(p_idempotency_key);

    if found then
      return query select v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status;
      return;
    end if;
  end if;

  -- 3. Load Store Settings
  select * into v_settings from public.settings where id = 1 for update;
  if not found then
    raise exception 'Configuration de la boutique introuvable.';
  end if;

  -- Check Storewide Promotion
  v_storewide_active :=
    coalesce(v_settings.storewide_discount_percent, 0) > 0
    and v_settings.discount_start_date is not null
    and v_settings.discount_end_date is not null
    and (now() at time zone 'Africa/Casablanca')::date between v_settings.discount_start_date and v_settings.discount_end_date;

  -- 4. Pessimistic Locking: Lock products in sorted slug order to prevent deadlocks
  select array_agg(distinct elem->>'slug' order by elem->>'slug')
  into v_slugs
  from jsonb_array_elements(p_items) elem;

  perform id from public.products
  where slug = any(v_slugs)
  order by slug
  for update;

  -- 5. Validate Line Items, Prices & Decrement Inventory
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product
    from public.products
    where slug = (v_item.elem->>'slug') and is_active = true;

    if not found then
      raise exception 'Produit indisponible ou introuvable : %', (v_item.elem->>'slug');
    end if;

    v_item_quantity := (v_item.elem->>'quantity')::integer;
    if v_item_quantity < 1 then
      raise exception 'Quantité invalide pour %', v_product.title;
    end if;

    -- Base price calculation (storewide discount excludes products already on promotion)
    v_base_price := v_product.price;
    if v_storewide_active and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_base_price := greatest(
        1.00::numeric(10,2),
        round(v_product.price * (100.0 - v_settings.storewide_discount_percent) / 100.0)::numeric(10,2)
      );
    end if;

    -- Check and decrement variant stock if size or color specified
    if (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null then
      select * into v_variant
      from public.product_variants
      where product_id = v_product.id
        and (v_item.elem->>'size') is not distinct from size
        and (v_item.elem->>'color') is not distinct from color
      for update;

      if not found then
        raise exception 'Variante introuvable pour % (% / %)', v_product.title, coalesce(v_item.elem->>'color', '—'), coalesce(v_item.elem->>'size', '—');
      end if;

      if v_variant.stock < v_item_quantity then
        raise exception 'Stock insuffisant pour % (%) : % restant(s)', v_product.title, coalesce(v_variant.color, v_variant.size), v_variant.stock;
      end if;

      -- Decrement variant stock
      update public.product_variants
      set stock = stock - v_item_quantity, updated_at = now()
      where id = v_variant.id;

      v_unit_price := (v_base_price + coalesce(v_variant.price_adjustment, 0.00))::numeric(10,2);
    else
      -- Decrement master product stock
      if v_product.stock < v_item_quantity then
        raise exception 'Stock insuffisant pour % : % restant(s)', v_product.title, v_product.stock;
      end if;

      v_unit_price := v_base_price;
    end if;

    -- Always decrement master product stock counter
    update public.products
    set stock = greatest(0, stock - v_item_quantity), updated_at = now()
    where id = v_product.id;

    v_line_total := (v_unit_price * v_item_quantity)::numeric(10,2);
    v_subtotal := (v_subtotal + v_line_total)::numeric(10,2);
    v_total_items := v_total_items + v_item_quantity;
  end loop;

  -- 6. Validate & Atomically Redeem Coupon
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select valid, discount_amount, message
    into v_coupon_valid, v_discount_total, v_coupon_message
    from public.validate_coupon(trim(p_coupon_code), v_subtotal);

    if not v_coupon_valid then
      raise exception 'Coupon invalide : %', v_coupon_message;
    end if;

    -- Atomically increment used_count under row lock
    update public.coupons
    set used_count = used_count + 1, updated_at = now()
    where code = lower(trim(p_coupon_code));
  end if;

  -- 7. Calculate Shipping Fee
  if v_settings.free_delivery_min_items > 0 and v_total_items >= v_settings.free_delivery_min_items then
    v_delivery_fee := 0.00;
  else
    v_delivery_fee := v_settings.delivery_fee;
  end if;

  v_total := greatest(0.00, (v_subtotal - v_discount_total + v_delivery_fee))::numeric(10,2);

  -- 8. Generate Order Identifiers
  v_order_id := 'ord-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_tracking_token := replace(gen_random_uuid()::text, '-', '');
  v_order_number := 'SAIS-' || upper(right(replace(v_order_id, '-', ''), 8));

  -- 9. Insert Order
  insert into public.orders (
    id, order_number, tracking_token, idempotency_key,
    customer_name, phone, city, address,
    client_email, client_name, items,
    subtotal, discount_total, delivery_fee, total,
    status, payment_method, payment_status, note,
    created_at, updated_at
  ) values (
    v_order_id, v_order_number, v_tracking_token, nullif(trim(p_idempotency_key), ''),
    v_customer_name, v_phone, coalesce(nullif(trim(p_city), ''), 'Casablanca'), trim(p_address),
    nullif(trim(p_client_email), ''), nullif(trim(p_client_name), ''), p_items,
    v_subtotal, v_discount_total, v_delivery_fee, v_total,
    'en_attente', 'cod', 'unpaid', nullif(trim(p_note), ''),
    now(), now()
  );

  -- 10. Insert Line Items Snapshot
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;
    select * into v_product from public.products where slug = (v_item.elem->>'slug');
    v_item_quantity := (v_item.elem->>'quantity')::integer;

    insert into public.order_items (
      order_id, product_id, variant, name_snapshot, unit_price, quantity, line_total, created_at
    ) values (
      v_order_id,
      v_product.id,
      nullif(trim(concat_ws(' / ', v_item.elem->>'color', v_item.elem->>'size')), ''),
      v_product.title,
      v_product.price,
      v_item_quantity,
      (v_product.price * v_item_quantity)::numeric(10,2),
      now()
    );
  end loop;

  -- 11. Insert Initial Status History
  insert into public.order_status_history (order_id, status, note, created_at)
  values (v_order_id, 'en_attente', 'Commande créée via le site (Paiement à la livraison)', now());

  -- 12. Upsert Client CRM Record
  v_first_name := split_part(v_customer_name, ' ', 1);
  v_last_name := substring(v_customer_name from length(v_first_name) + 2);
  if v_last_name is null or v_last_name = '' then
    v_last_name := '—';
  end if;

  insert into public.clients (
    phone, first_name, last_name, email, city, address, order_count, total_spent, created_at, updated_at
  ) values (
    v_phone, v_first_name, v_last_name, nullif(trim(p_client_email), ''), coalesce(nullif(trim(p_city), ''), 'Casablanca'), trim(p_address), 1, v_total, now(), now()
  )
  on conflict (phone) do update set
    first_name = excluded.first_name,
    last_name = case when excluded.last_name <> '—' then excluded.last_name else public.clients.last_name end,
    email = coalesce(excluded.email, public.clients.email),
    city = excluded.city,
    address = excluded.address,
    order_count = public.clients.order_count + 1,
    total_spent = public.clients.total_spent + excluded.total_spent,
    updated_at = now();

  return query select v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, 'en_attente'::text;
end;
$$;

-- 11.7 Trigger for New Supabase Auth Users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

-- Settings: Public select; Admin full CRUD
drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings
  for select to public using (true);

drop policy if exists "Admin manage settings" on public.settings;
create policy "Admin manage settings" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Products: Public select (active only); Admin full CRUD
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products
  for select to public using (is_active = true);

drop policy if exists "Admin manage products" on public.products;
create policy "Admin manage products" on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Product Variants: Public select; Admin full CRUD
drop policy if exists "Public read product variants" on public.product_variants;
create policy "Public read product variants" on public.product_variants
  for select to public using (true);

drop policy if exists "Admin manage product variants" on public.product_variants;
create policy "Admin manage product variants" on public.product_variants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Profiles: Own user read/update; Admin read all
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (role <> 'admin' or public.is_admin());

drop policy if exists "Admin manage all profiles" on public.profiles;
create policy "Admin manage all profiles" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Orders: Authenticated Admins have full access. No public direct SELECT/INSERT/UPDATE.
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Order Items: Authenticated Admins have full access.
drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items" on public.order_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Order Status History: Authenticated Admins have full access.
drop policy if exists "Admins manage order status history" on public.order_status_history;
create policy "Admins manage order status history" on public.order_status_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Clients: Authenticated Admins have full access.
drop policy if exists "Admins manage clients" on public.clients;
create policy "Admins manage clients" on public.clients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Coupons: Authenticated Admins have full access.
drop policy if exists "Admins manage coupons" on public.coupons;
create policy "Admins manage coupons" on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------
-- 13. PRIVILEGES & FUNCTION EXECUTION GRANTS
-- ------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.normalize_moroccan_phone(text) to public, anon, authenticated, service_role;
grant execute on function public.order_reference_for_tracking(text) to public, anon, authenticated, service_role;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated, service_role;
grant execute on function public.get_order_for_tracking(text, text) to anon, authenticated, service_role;
grant execute on function public.place_order_rpc(uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text) to service_role;

-- ========================================================================
-- END OF CANONICAL PRODUCTION SCHEMA
-- ========================================================================
