-- ========================================================================
-- SAIS Store — Migration: storewide promotion inside place_order_rpc
-- Run this in the Supabase SQL Editor (there is no db:push script).
--
-- Why: lib/pricing.ts getStorePrice() applies the date-windowed storewide
-- discount for display, but place_order_rpc charged products.price only.
-- With an active promotion the review screen and the order total disagreed.
-- This migration redefines the RPC with the same rule as getStorePrice():
--   • the discount applies only when storewide_discount_percent > 0 AND both
--     dates are set AND today (Africa/Casablanca) is inside the window;
--   • products that already have a crossed-out price (original_price > price)
--     are excluded;
--   • result is rounded and never below 1 MAD.
-- Signature, statuses, coupon handling, stock and history are unchanged.
-- ========================================================================

create or replace function public.place_order_rpc(
  p_auth_user_id uuid,
  p_customer_id uuid,
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
  v_status text;
  v_item record;
  v_product record;
  v_variant record;
  v_unit_price integer;
  v_base_price integer;
  v_line_total integer;
  v_item_quantity integer;
  v_variant_stock integer;
  v_total_items integer := 0;
  v_storewide_active boolean := false;
  i integer;
begin
  -- Idempotency: if this key was already used, return the existing order
  if p_idempotency_key is not null then
    select id, order_reference_for_tracking(id), tracking_token, subtotal, discount_total, delivery_fee, total, status
    into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status
    from public.orders
    where id = p_idempotency_key
      or (tracking_token = p_idempotency_key);

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

  -- Validate items, check stock, compute subtotal
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select * into v_item from jsonb_array_elements(p_items) with ordinality arr(elem, ord) where arr.ord = i + 1;

    select * into v_product from public.products where slug = (v_item.elem->>'slug') limit 1;
    if not found then
      raise exception 'Produit introuvable : %', v_item.elem->>'slug';
    end if;

    v_item_quantity := (v_item.elem->>'quantity')::integer;

    -- Base price: storewide promotion excluded products already on sale
    v_base_price := v_product.price;
    if v_storewide_active
      and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_base_price := greatest(
        1,
        round(v_product.price * (100 - v_settings.storewide_discount_percent) / 100.0)::integer
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

  -- Apply coupon
  if p_coupon_code is not null and p_coupon_code <> '' then
    select * into v_discount_total from public.validate_coupon(p_coupon_code, v_subtotal);
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

  -- Insert order (customer_id included atomically)
  insert into public.orders (
    auth_user_id, customer_id, client_email, client_name, customer_name,
    phone, address, items, subtotal, discount_total, delivery_fee, total,
    status, note, tracking_token
  )
  values (
    p_auth_user_id,
    p_customer_id,
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

    v_base_price := v_product.price;
    if v_storewide_active
      and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_base_price := greatest(
        1,
        round(v_product.price * (100 - v_settings.storewide_discount_percent) / 100.0)::integer
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
