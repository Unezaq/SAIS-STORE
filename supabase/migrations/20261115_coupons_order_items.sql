-- ========================================================================
-- SAIS Store — Migration: coupons, order_items, order_status_history
-- Run this in Supabase SQL Editor
-- ========================================================================

-- --------------------------------------------------------
-- 1. COUPONS
-- --------------------------------------------------------
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percentage', 'fixed')),
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

create index if not exists idx_coupons_code on coupons(code);
create index if not exists idx_coupons_is_active on coupons(is_active);

-- --------------------------------------------------------
-- 2. PRODUCT VARIANTS + STOCK
-- --------------------------------------------------------
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  size text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  price_adjustment integer not null default 0, -- extra charge in MAD, can be negative
  sku text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (product_id, size, color)
);

create index if not exists idx_product_variants_product on product_variants(product_id);
create index if not exists idx_product_variants_stock on product_variants(stock);

-- add stock column to products (legacy single-stock fallback)
alter table public.products
  add column if not exists stock integer not null default 0 check (stock >= 0);

-- --------------------------------------------------------
-- 3. ORDER ITEMS (price snapshot per line)
-- --------------------------------------------------------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  variant text, -- e.g. "M · Rouge" or JSON stringified {size, color}
  name_snapshot text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity >= 1),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz default now()
);

create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

-- --------------------------------------------------------
-- 4. ORDER STATUS HISTORY
-- --------------------------------------------------------
create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_order_status_history_order on order_status_history(order_id);

-- --------------------------------------------------------
-- 5. TRACKING TOKEN on orders
-- --------------------------------------------------------
alter table public.orders
  add column if not exists tracking_token text unique;

create index if not exists idx_orders_tracking_token on orders(tracking_token);

-- --------------------------------------------------------
-- 6. RLS for new tables
-- --------------------------------------------------------
alter table public.coupons enable row level security;
alter table public.product_variants enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

-- Coupons: public can validate (via RPC), but not list/read directly
create policy "Coupons are not publicly readable" on public.coupons
  for all to authenticated using (false);

-- Product variants: public read
create policy "Public read product variants" on public.product_variants
  for select to anon, authenticated using (true);

-- Order items: only order owner (authenticated) or admin
create policy "Users can read own order items" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.auth_user_id = (select auth.uid())
    )
  );

-- Order status history: only order owner (authenticated) or admin
create policy "Users can read own order status history" on public.order_status_history
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.auth_user_id = (select auth.uid())
    )
  );

-- Admin can manage everything new
create policy "Admins can manage coupons" on public.coupons
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage product variants" on public.product_variants
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage order items" on public.order_items
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage order status history" on public.order_status_history
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- --------------------------------------------------------
-- 7. RPC: validate_coupon
-- --------------------------------------------------------
create or replace function public.validate_coupon(
  p_code text,
  p_subtotal integer
)
returns table (
  valid boolean,
  discount_amount integer,
  message text
)
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

-- --------------------------------------------------------
-- 8. RPC: place_order (atomic)
-- --------------------------------------------------------
create or replace function public.place_order_rpc(
  p_auth_user_id uuid,
  p_client_email text,
  p_client_name text,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_items jsonb, -- [{slug, color, size, quantity}]
  p_note text,
  p_coupon_code text,
  p_idempotency_key text
)
returns table (
  order_id text,
  order_number text,
  tracking_token text,
  subtotal integer,
  discount_total integer,
  delivery_fee integer,
  total integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_order_id text;
  v_tracking_token text;
  v_order_number text;
  v_item record;
  v_product record;
  v_variant record;
  v_unit_price integer;
  v_line_total integer;
  v_item_quantity integer;
  v_variant_stock integer;
  i integer;
begin
  -- Idempotency: if this key was already used, return the existing order
  if p_idempotency_key is not null then
    select id, order_reference_for_tracking(id), tracking_token, subtotal, discount_total, delivery_fee, total, status
    into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status
    from public.orders
    where id = p_idempotency_key or (tracking_token = p_idempotency_key);

    if found then
      return query select v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status;
    end if;
  end if;

  -- Settings
  select * into v_settings from public.settings where id = 1;

  -- Validate items, check stock, compute subtotal
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;
    if not found then
      raise exception 'Produit introuvable : %', v_item.elem->>'slug';
    end if;

    v_item_quantity := (v_item.elem->>'quantity')::integer;

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

      v_unit_price := v_product.price + coalesce(v_variant.price_adjustment, 0);
    else
      -- Legacy: use product stock
      if v_product.stock < v_item_quantity then
        raise exception 'Stock insuffisant pour % (% restant)', v_product.title, v_product.stock;
      end if;

      v_unit_price := v_product.price;
    end if;

    v_line_total := v_unit_price * v_item_quantity;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- Apply coupon
  if p_coupon_code is not null and p_coupon_code <> '' then
    select * into v_discount_total from public.validate_coupon(p_coupon_code, v_subtotal);
    -- validate_coupon returns (valid, discount_amount, message); we need discount_amount
    -- If invalid, raise exception
    if not (select valid from public.validate_coupon(p_coupon_code, v_subtotal)) then
      raise exception 'Coupon invalide : %', (select message from public.validate_coupon(p_coupon_code, v_subtotal));
    end if;
    select discount_amount into v_discount_total from public.validate_coupon(p_coupon_code, v_subtotal);
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

  -- Generate tracking token
  v_tracking_token := gen_random_uuid()::text;

  -- Insert order
  insert into public.orders (
    auth_user_id, client_email, client_name, customer_name, phone, address,
    items, subtotal, discount_total, delivery_fee, total,
    status, note, tracking_token
  )
  values (
    p_auth_user_id,
    p_client_email,
    p_client_name,
    p_customer_name,
    p_phone,
    p_address,
    p_items,
    v_subtotal,
    v_discount_total,
    v_delivery_fee,
    v_total,
    'en_attente',
    p_note,
    v_tracking_token
  )
  returning id, tracking_token into v_order_id, v_tracking_token;

  select 'SAIS-' || upper(right(replace(v_order_id, '-', ''), 8)) into v_order_number;

  -- Insert order items + decrement stock + increment coupon usage
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;

    v_item_quantity := (v_item.elem->>'quantity')::integer;
    v_variant_stock := null;

    if (v_item.elem->>'size') is not null or (v_item.elem->>'color') is not null then
      select * into v_variant
      from public.product_variants
      where product_id = v_product.id
        and (v_item.elem->>'size') is not distinct from size
        and (v_item.elem->>'color') is not distinct from color
      limit 1;

      v_unit_price := v_product.price + coalesce(v_variant.price_adjustment, 0);
    else
      v_unit_price := v_product.price;
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
      set stock = stock - v_item_quantity,
          updated_at = now()
      where id = v_variant.id;
    else
      update public.products
      set stock = stock - v_item_quantity,
          updated_at = now()
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

-- Helper: order_reference_for_tracking (used by idempotency)
create or replace function public.order_reference_for_tracking(p_order_id text)
returns text
language plpgsql
as $$
declare
  v_id text;
begin
  select id into v_id from public.orders where id = p_order_id;
  return 'SAIS-' || upper(right(replace(v_id, '-', ''), 8));
end;
$$;

-- --------------------------------------------------------
-- 8b. RPC: get order for public tracking (guest)
-- --------------------------------------------------------
create or replace function public.get_order_for_tracking(
  p_order_number text,
  p_phone text
)
returns table (
  order_id text,
  order_number text,
  tracking_token text,
  status text,
  created_at timestamptz,
  total integer,
  subtotal integer,
  delivery_fee integer,
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
  v_phone text := normalize_moroccan_phone(p_phone);
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

-- Helper: normalize moroccan phone inside SQL
create or replace function public.normalize_moroccan_phone(p_value text)
returns text
language plpgsql
immutable
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
