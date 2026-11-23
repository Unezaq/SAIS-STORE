-- 20261123 — Fix: place_order_rpc failed on every checkout with an idempotency key.
--
-- The idempotency lookup selected unqualified columns (order_number, tracking_token,
-- subtotal, discount_total, delivery_fee, total, status) that collided with the
-- function OUT parameters. PL/pgSQL raised 42702 "column reference ... is ambiguous",
-- so place_order_rpc always errored and no order could be created.
--
-- Only the idempotency SELECT is qualified with an alias (o.); the rest of the
-- function is identical to 20261122_sais_store_production.sql.
-- Apply in the Supabase SQL Editor.

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
    select o.id, o.order_number, o.tracking_token, o.subtotal, o.discount_total, o.delivery_fee, o.total, o.status
    into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount_total, v_delivery_fee, v_total, v_status
    from public.orders o
    where o.idempotency_key = trim(p_idempotency_key);

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
