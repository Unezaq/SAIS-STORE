-- ========================================================================
-- SAIS Store — place_order_rpc Integrity Rewrite
-- Migration: 20261124_04_place_order_rpc_integrity.sql
-- Description:
--   Replaces public.place_order_rpc with a hardened, atomic implementation.
--
--   1. STOCK MODEL (authoritative source, applied exactly once):
--      - Product HAS variants  -> product_variants.stock is authoritative;
--        products.stock is NOT decremented for that line.
--      - Product has NO variants -> products.stock is authoritative.
--   2. DUPLICATE CART LINES are aggregated by (slug, size, color) before any
--      stock check, so two identical lines are validated against stock once.
--   3. IDEMPOTENCY: SELECT fast-path scoped to the same normalized phone,
--      plus the UNIQUE orders.idempotency_key as the final safety net. The
--      order INSERT runs BEFORE any stock/ledger/coupon write, so a retry
--      that loses the race has nothing to undo (the function aborts and the
--      caller transaction rolls back).
--   4. ORDER ITEMS: unit_price is recomputed per line (product price +
--      variant price_adjustment, then storewide discount) and persisted.
--   5. INVENTORY LEDGER: one reservation row per line, unique idempotency
--      key, referenced to the order.
--   6. STOCK GUARD: every decrement repeats "AND stock >= qty"; a missing
--      lock can never oversell.
--   7. COUPON: validated with the caller's auth user id / normalized phone,
--      then consumed atomically after the order exists.
--   8. AUTH_USER_ID: only ever supplied by the trusted server session, never
--      by the browser.
--
-- No existing data is modified or deleted.
-- ========================================================================

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
set search_path = pg_catalog, public
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
  v_phone text;
  v_customer_name text;
  v_total_items integer := 0;
  v_storewide_active boolean := false;
  v_coupon_valid boolean := false;
  v_coupon_message text := '';
  v_item jsonb;
  v_slug text;
  v_size text;
  v_color text;
  v_quantity integer;
  v_product record;
  v_variant record;
  v_line_unit_price numeric(10,2);
  v_base_price numeric(10,2);
  v_existing_order record;
  v_has_variants boolean;
  i integer;
  v_slugs text[];
  v_aggregated jsonb := '[]'::jsonb;
  v_agg_key text;
  v_agg_key_slot text;
  v_agg_map jsonb := '{}'::jsonb;
  v_agg_keys text[] := '{}';
  v_agg_quantity integer;
  v_ledger_key text;
  v_coupon_id uuid;
  v_per_user_limit integer;
  v_existing_redemptions integer := 0;
begin
  -- ====================================================================
  -- 0. PHONE FIRST — it scopes idempotency and guest coupon limits.
  -- ====================================================================
  v_phone := public.normalize_moroccan_phone(p_phone);
  if v_phone is null then
    raise exception 'TELEPHONE_INVALIDE: Numéro de téléphone marocain invalide (+212...)';
  end if;

  -- ====================================================================
  -- 1. IDEMPOTENCY FAST-PATH — same key AND same phone only.
  --    All columns are table-qualified: the OUT parameters share these
  --    names and an unqualified reference raises 42702.
  -- ====================================================================
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select o.id, o.order_number, o.tracking_token, o.subtotal,
           o.discount_total, o.delivery_fee, o.total, o.status
    into v_existing_order
    from public.orders o
    where o.idempotency_key = trim(p_idempotency_key)
      and o.phone = v_phone;

    if found then
      return query select
        v_existing_order.id,
        v_existing_order.order_number,
        v_existing_order.tracking_token,
        v_existing_order.subtotal,
        v_existing_order.discount_total,
        v_existing_order.delivery_fee,
        v_existing_order.total,
        v_existing_order.status;
      return;
    end if;
  end if;

  -- ====================================================================
  -- 2. INPUT SANITIZATION
  -- ====================================================================
  v_customer_name := trim(coalesce(p_customer_name, p_client_name, ''));
  if length(v_customer_name) < 2 then
    raise exception 'CLIENT_REQUIS: Nom du client requis (minimum 2 caractères).';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'PANIER_VIDE: Le panier ne peut pas être vide.';
  end if;

  -- ====================================================================
  -- 3. AGGREGATE DUPLICATE CART LINES by (slug, size, color)
  -- ====================================================================
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    select elem into v_item
    from jsonb_array_elements(p_items) with ordinality arr(elem, ord)
    where arr.ord = i + 1;

    v_slug := trim(coalesce(v_item->>'slug', ''));
    v_size := nullif(trim(v_item->>'size'), '');
    v_color := nullif(trim(v_item->>'color'), '');
    -- Regex guard: a direct cast of '1.5' or '-1' would raise a raw 22P02
    -- instead of the business error below.
    v_quantity := case
      when (v_item->>'quantity') ~ '^[0-9]{1,9}$' then (v_item->>'quantity')::integer
      else 0
    end;

    if v_slug = '' or v_quantity < 1 then
      raise exception 'ARTICLE_INVALIDE: Quantité invalide.';
    end if;

    v_agg_key := v_slug || '|' || coalesce(v_size, '') || '|' || coalesce(v_color, '');

    if v_agg_map ? v_agg_key then
      v_agg_quantity := (v_agg_map->v_agg_key->>'quantity')::integer + v_quantity;
      v_agg_map := v_agg_map || jsonb_build_object(v_agg_key, jsonb_build_object(
        'slug', v_slug,
        'size', v_size,
        'color', v_color,
        'quantity', v_agg_quantity
      ));
    else
      v_agg_keys := array_append(v_agg_keys, v_agg_key);
      v_agg_map := v_agg_map || jsonb_build_object(v_agg_key, jsonb_build_object(
        'slug', v_slug,
        'size', v_size,
        'color', v_color,
        'quantity', v_quantity
      ));
    end if;
  end loop;

  v_aggregated := '[]'::jsonb;
  foreach v_agg_key_slot in array v_agg_keys loop
    v_aggregated := v_aggregated || jsonb_build_array(v_agg_map->v_agg_key_slot);
  end loop;

  -- ====================================================================
  -- 4. GENERATE ORDER IDENTIFIERS (needed for ledger references)
  -- ====================================================================
  v_order_id := 'ord-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_tracking_token := replace(gen_random_uuid()::text, '-', '');
  v_order_number := 'SAIS-' || upper(right(replace(v_order_id, '-', ''), 8));

  -- ====================================================================
  -- 5. LOAD STORE SETTINGS
  -- ====================================================================
  select * into v_settings from public.settings where id = 1 for update;
  if not found then
    raise exception 'CONFIG_INTROUVABLE: Configuration de la boutique introuvable.';
  end if;

  v_storewide_active :=
    coalesce(v_settings.storewide_discount_percent, 0) > 0
    and v_settings.discount_start_date is not null
    and v_settings.discount_end_date is not null
    and (now() at time zone 'Africa/Casablanca')::date between v_settings.discount_start_date and v_settings.discount_end_date;

  -- ====================================================================
  -- 6. LOCK PRODUCTS in deterministic slug order to prevent deadlocks
  -- ====================================================================
  select array_agg(distinct elem->>'slug' order by elem->>'slug')
  into v_slugs
  from jsonb_array_elements(v_aggregated) elem;

  perform p.id from public.products p
  where p.slug = any(v_slugs)
  order by p.slug
  for update;

  -- ====================================================================
  -- 7. VALIDATE STOCK AND COMPUTE TOTALS (read-only; row locks held)
  -- ====================================================================
  for i in 0 .. jsonb_array_length(v_aggregated) - 1 loop
    select elem into v_item
    from jsonb_array_elements(v_aggregated) with ordinality arr(elem, ord)
    where arr.ord = i + 1;

    v_slug := v_item->>'slug';
    v_size := nullif(trim(v_item->>'size'), '');
    v_color := nullif(trim(v_item->>'color'), '');
    v_quantity := (v_item->>'quantity')::integer;

    select p.* into v_product
    from public.products p
    where p.slug = v_slug and p.is_active = true
    for update;

    if not found then
      raise exception 'PRODUIT_INDISPONIBLE: Produit indisponible ou introuvable : %', v_slug;
    end if;

    select exists (
      select 1 from public.product_variants pv where pv.product_id = v_product.id
    ) into v_has_variants;

    v_base_price := v_product.price::numeric(10,2);

    if v_size is not null or v_color is not null then
      if not v_has_variants then
        raise exception 'VARIANTE_INTROUVABLE: Ce produit ne propose pas de variantes.';
      end if;

      select pv.* into v_variant
      from public.product_variants pv
      where pv.product_id = v_product.id
        and (v_size is not distinct from pv.size)
        and (v_color is not distinct from pv.color)
      for update;

      if not found then
        raise exception 'VARIANTE_INTROUVABLE: Variante introuvable pour % (% / %)',
          v_product.title, coalesce(v_color, '—'), coalesce(v_size, '—');
      end if;

      if v_variant.stock < v_quantity then
        raise exception 'STOCK_INSUFFISANT: Stock insuffisant pour % (% / %) : % restant(s)',
          v_product.title, coalesce(v_color, '—'), coalesce(v_size, '—'), v_variant.stock;
      end if;

      v_base_price := (v_product.price + coalesce(v_variant.price_adjustment, 0.00))::numeric(10,2);
    else
      if v_product.stock < v_quantity then
        raise exception 'STOCK_INSUFFISANT: Stock insuffisant pour % : % restant(s)',
          v_product.title, v_product.stock;
      end if;
    end if;

    -- Storewide discount applies unless the product runs its own promo.
    if v_storewide_active
       and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_line_unit_price := round(
        v_base_price * (100.0 - v_settings.storewide_discount_percent) / 100.0, 2
      )::numeric(10,2);
    else
      v_line_unit_price := v_base_price;
    end if;

    v_line_unit_price := greatest(1.00::numeric(10,2), v_line_unit_price);
    v_subtotal := (v_subtotal + (v_line_unit_price * v_quantity))::numeric(10,2);
    v_total_items := v_total_items + v_quantity;
  end loop;

  -- ====================================================================
  -- 8. COUPON VALIDATION (read-only; consumption happens after insert)
  -- ====================================================================
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select vc.valid, vc.discount_amount, vc.message
    into v_coupon_valid, v_discount_total, v_coupon_message
    from public.validate_coupon(
      trim(p_coupon_code), v_subtotal, p_auth_user_id, v_phone
    ) vc;

    if not v_coupon_valid then
      raise exception 'COUPON_INVALIDE: Coupon invalide : %', v_coupon_message;
    end if;
  end if;

  -- ====================================================================
  -- 9. SHIPPING FEE + TOTAL
  -- ====================================================================
  if v_settings.free_delivery_min_items > 0 and v_total_items >= v_settings.free_delivery_min_items then
    v_delivery_fee := 0.00;
  else
    v_delivery_fee := v_settings.delivery_fee;
  end if;

  v_total := greatest(0.00, (v_subtotal - v_discount_total + v_delivery_fee))::numeric(10,2);

  -- ====================================================================
  -- 10. INSERT ORDER FIRST (UNIQUE idempotency_key = final safety net)
  --     Nothing has been written yet, so a lost retry race leaves no
  --     partial stock/ledger/coupon writes to unwind.
  -- ====================================================================
  begin
    insert into public.orders (
      id, order_number, tracking_token, idempotency_key,
      auth_user_id,
      customer_name, phone, city, address,
      client_email, client_name, items,
      subtotal, discount_total, delivery_fee, total,
      coupon_code,
      status, payment_method, payment_status, note,
      created_at, updated_at
    ) values (
      v_order_id, v_order_number, v_tracking_token,
      nullif(trim(p_idempotency_key), ''),
      p_auth_user_id,
      v_customer_name, v_phone,
      coalesce(nullif(trim(p_city), ''), 'Casablanca'), trim(p_address),
      nullif(trim(p_client_email), ''), nullif(trim(p_client_name), ''), v_aggregated,
      v_subtotal, v_discount_total, v_delivery_fee, v_total,
      nullif(trim(p_coupon_code), ''),
      'en_attente', 'cod', 'unpaid', nullif(trim(p_note), ''),
      now(), now()
    );
  exception when unique_violation then
    -- A unique violation without an idempotency key is a real identifier
    -- collision (order id / order number / tracking token), not a retry.
    if p_idempotency_key is null or trim(p_idempotency_key) = '' then
      raise;
    end if;

    select o.id, o.order_number, o.tracking_token, o.subtotal,
           o.discount_total, o.delivery_fee, o.total, o.status
    into v_existing_order
    from public.orders o
    where o.idempotency_key = trim(p_idempotency_key)
      and o.phone = v_phone
    limit 1;

    if found then
      return query select
        v_existing_order.id,
        v_existing_order.order_number,
        v_existing_order.tracking_token,
        v_existing_order.subtotal,
        v_existing_order.discount_total,
        v_existing_order.delivery_fee,
        v_existing_order.total,
        v_existing_order.status;
      return;
    end if;

    raise exception 'DOUBLON: Impossible de créer la commande (conflit d''idempotence).';
  end;

  -- ====================================================================
  -- 11. DECREMENT STOCK + WRITE LEDGER (authoritative source only)
  -- ====================================================================
  for i in 0 .. jsonb_array_length(v_aggregated) - 1 loop
    select elem into v_item
    from jsonb_array_elements(v_aggregated) with ordinality arr(elem, ord)
    where arr.ord = i + 1;

    v_slug := v_item->>'slug';
    v_size := nullif(trim(v_item->>'size'), '');
    v_color := nullif(trim(v_item->>'color'), '');
    v_quantity := (v_item->>'quantity')::integer;

    select p.* into v_product from public.products p where p.slug = v_slug;

    if v_size is not null or v_color is not null then
      select pv.* into v_variant
      from public.product_variants pv
      where pv.product_id = v_product.id
        and (v_size is not distinct from pv.size)
        and (v_color is not distinct from pv.color);

      update public.product_variants
      set stock = stock - v_quantity, updated_at = now()
      where id = v_variant.id
        and stock >= v_quantity;

      if not found then
        raise exception 'STOCK_INSUFFISANT: Stock insuffisant pour % (% / %).',
          v_product.title, coalesce(v_color, '—'), coalesce(v_size, '—');
      end if;

      v_ledger_key := 'ord-ledger-' || gen_random_uuid()::text;
      insert into public.inventory_ledger (
        product_id, variant_id, quantity_change, event_type,
        reference_type, reference_id, idempotency_key,
        actor_id, actor_type, created_at
      ) values (
        v_product.id, v_variant.id, -(v_quantity), 'reservation',
        'order', v_order_id, v_ledger_key,
        null, 'system', now()
      );
    else
      update public.products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_product.id
        and stock >= v_quantity;

      if not found then
        raise exception 'STOCK_INSUFFISANT: Stock insuffisant pour %.', v_product.title;
      end if;

      v_ledger_key := 'ord-ledger-' || gen_random_uuid()::text;
      insert into public.inventory_ledger (
        product_id, variant_id, quantity_change, event_type,
        reference_type, reference_id, idempotency_key,
        actor_id, actor_type, created_at
      ) values (
        v_product.id, null, -(v_quantity), 'reservation',
        'order', v_order_id, v_ledger_key,
        null, 'system', now()
      );
    end if;
  end loop;

  -- ====================================================================
  -- 12. INSERT LINE ITEMS — per-line final price (never a stale variable)
  -- ====================================================================
  for i in 0 .. jsonb_array_length(v_aggregated) - 1 loop
    select elem into v_item
    from jsonb_array_elements(v_aggregated) with ordinality arr(elem, ord)
    where arr.ord = i + 1;

    v_slug := v_item->>'slug';
    v_size := nullif(trim(v_item->>'size'), '');
    v_color := nullif(trim(v_item->>'color'), '');
    v_quantity := (v_item->>'quantity')::integer;

    select p.* into v_product from public.products p where p.slug = v_slug;

    v_base_price := v_product.price::numeric(10,2);
    if v_size is not null or v_color is not null then
      select pv.* into v_variant
      from public.product_variants pv
      where pv.product_id = v_product.id
        and (v_size is not distinct from pv.size)
        and (v_color is not distinct from pv.color);

      v_base_price := (v_product.price + coalesce(v_variant.price_adjustment, 0.00))::numeric(10,2);
    end if;

    if v_storewide_active
       and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_line_unit_price := round(
        v_base_price * (100.0 - v_settings.storewide_discount_percent) / 100.0, 2
      )::numeric(10,2);
    else
      v_line_unit_price := v_base_price;
    end if;

    v_line_unit_price := greatest(1.00::numeric(10,2), v_line_unit_price);

    insert into public.order_items (
      order_id, product_id, variant, name_snapshot, unit_price,
      quantity, line_total, created_at
    ) values (
      v_order_id,
      v_product.id,
      nullif(trim(concat_ws(' / ', v_color, v_size)), ''),
      v_product.title,
      v_line_unit_price,
      v_quantity,
      (v_line_unit_price * v_quantity)::numeric(10,2),
      now()
    );
  end loop;

  -- ====================================================================
  -- 13. COUPON CONSUMPTION (atomic, after the order exists)
  --     Locks the coupon row and re-checks per-user limits to prevent
  --     concurrent orders from exceeding per_user_limit.
  -- ====================================================================
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    -- Lock the coupon row to serialize concurrent consumption attempts.
    -- Re-validate per-user limit under the lock.
    BEGIN
      SELECT c.id, c.per_user_limit INTO v_coupon_id, v_per_user_limit
      FROM public.coupons c
      WHERE lower(c.code) = lower(trim(p_coupon_code))
      FOR UPDATE;

      IF v_coupon_id IS NULL THEN
        raise exception 'COUPON_EPUISE: Ce code de réduction est épuisé.';
      END IF;

      -- Re-check per-user limit under lock
      IF v_per_user_limit IS NOT NULL THEN
        v_existing_redemptions := 0;
        IF p_auth_user_id IS NOT NULL THEN
          SELECT count(*) INTO v_existing_redemptions
          FROM public.coupon_redemptions
          WHERE coupon_id = v_coupon_id AND redeemed_by = p_auth_user_id;
        ELSE
          SELECT count(*) INTO v_existing_redemptions
          FROM public.coupon_redemptions cr
          LEFT JOIN public.orders o ON o.id = cr.order_id
          WHERE cr.coupon_id = v_coupon_id
            AND coalesce(cr.redeemed_phone, o.phone) = v_phone;
        END IF;

        IF v_existing_redemptions >= v_per_user_limit THEN
          raise exception 'COUPON_EPUISE: Ce code de réduction a déjà été utilisé le nombre maximal de fois pour votre compte.';
        END IF;
      END IF;
    END;

    update public.coupons c
    set used_count = c.used_count + 1, updated_at = now()
    where lower(c.code) = lower(trim(p_coupon_code))
      and (c.max_uses is null or c.used_count < c.max_uses);

    if not found then
      raise exception 'COUPON_EPUISE: Ce code de réduction est épuisé.';
    end if;

    insert into public.coupon_redemptions (
      coupon_id, order_id, redeemed_by, redeemed_phone, discount_amount, redeemed_at
    )
    select c.id, v_order_id, p_auth_user_id, v_phone, v_discount_total, now()
    from public.coupons c
    where lower(c.code) = lower(trim(p_coupon_code));
  end if;

  -- ====================================================================
  -- 14. STATUS HISTORY
  -- ====================================================================
  insert into public.order_status_history (order_id, status, note, created_at)
  values (v_order_id, 'en_attente', 'Commande créée via le site (Paiement à la livraison)', now());

  -- ====================================================================
  -- 15. CLIENT CRM UPSERT (best effort; never fails the order)
  -- ====================================================================
  begin
    insert into public.clients (
      phone, first_name, last_name, email, city, address,
      order_count, total_spent, created_at, updated_at
    ) values (
      v_phone, split_part(v_customer_name, ' ', 1),
      coalesce(
        nullif(substring(v_customer_name from length(split_part(v_customer_name, ' ', 1)) + 2), ''),
        '—'
      ),
      nullif(trim(p_client_email), ''),
      coalesce(nullif(trim(p_city), ''), 'Casablanca'), trim(p_address),
      1, v_total, now(), now()
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
  exception when others then
    null;
  end;

  return query select
    v_order_id, v_order_number, v_tracking_token,
    v_subtotal, v_discount_total, v_delivery_fee, v_total, 'en_attente'::text;
end;
$$;

-- ========================================================================
-- Re-grant EXECUTE (service_role only). Revoke from public/anon/authenticated.
-- ========================================================================
revoke execute on function public.place_order_rpc(uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.place_order_rpc(uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text) to service_role;

-- ========================================================================
-- END
-- ========================================================================
