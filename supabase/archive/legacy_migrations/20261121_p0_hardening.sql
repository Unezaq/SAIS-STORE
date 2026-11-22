-- ========================================================================
-- SAIS Store — P0 hardening: RLS/grants, clients.phone uniqueness,
--                  atomic place_order_rpc (stock + coupon + idempotency)
--
-- Run AFTER:
--   supabase/migrations/20261118_sais_store_schema.sql
--   supabase/migrations/20261118_auth_trigger.sql
--   supabase/migrations/20261119_cleanup_cod_system.sql
--   supabase/migrations/20261119_guest_first_rls.sql
--
-- Idempotent: safe to re-run. Contains no data deletion except the
-- duplicate `clients` merge in section 2 (which keeps one row per phone
-- and sums its counters before deleting the redundant rows).
--
-- Fixes:
--   F2.1  anon SELECT on public.orders           (policy `Anon can read own orders`)
--   F2.2  anon INSERT on orders / order_items    (policies `Anon can ...`)
--   F3.2  clients.phone not unique               (plain index only)
--   F3.3  coupon max_uses never enforced atomically
--   F3.1  stock check-then-decrement race        (no row lock, no guard)
--   NEW   place_order_rpc EXECUTE not granted to service_role after
--         `revoke ... from public` → server-side checkout could not call
--         the RPC and silently fell back to a stock-blind direct insert.
-- ========================================================================

-- --------------------------------------------------------
-- 1. Close anon access to order + customer data (F2.1 / F2.2)
--
--    Guest checkout never touches these tables directly: orders are
--    written by place_order_rpc (service_role) and read by tracking
--    server actions with the service role. Anon therefore needs no
--    privilege at all on them.
--
--    `authenticated` intentionally keeps SELECT: /admin/orders calls
--    getOrders() through the SSR client, and RLS restricts rows through
--    the "Users or admins read orders" policy (own rows, or is_admin()).
-- --------------------------------------------------------
drop policy if exists "Anon can create orders" on public.orders;
drop policy if exists "Anon can read own orders" on public.orders;
drop policy if exists "Anon can create order items" on public.order_items;

revoke all on table public.orders from anon;
revoke all on table public.order_items from anon;
revoke all on table public.order_status_history from anon;
revoke all on table public.clients from anon;
revoke all on table public.coupons from anon;

-- --------------------------------------------------------
-- 2. clients: updated_at column + UNIQUE(phone) (F3.2)
--
--    `lib/store.ts#saveGuestClientFromOrder` and the previous RPC both
--    assume one row per phone (`ON CONFLICT (phone)` needs a unique
--    constraint or a unique index). Until now `idx_clients_phone` was a
--    plain index, so `ON CONFLICT (phone)` raised 42P10 and every guest
--    checkout that hit that branch failed.
-- --------------------------------------------------------
alter table public.clients add column if not exists updated_at timestamptz default now();

-- Merge duplicate phones first (kept row = the one with most orders,
-- then the oldest). totals are summed so no order history is lost.
do $$
declare
  v_phone text;
  v_keep uuid;
  v_count integer;
  v_spent integer;
begin
  for v_phone, v_keep, v_count, v_spent in
    select
      phone,
      (array_agg(id order by coalesce(order_count, 0) desc, created_at asc nulls last))[1],
      sum(coalesce(order_count, 0))::integer,
      sum(coalesce(total_spent, 0))::integer
    from public.clients
    group by phone
    having count(*) > 1
  loop
    update public.clients
       set order_count = v_count,
           total_spent = v_spent,
           updated_at = now()
     where id = v_keep;

    delete from public.clients
     where phone = v_phone
       and id <> v_keep;
  end loop;
end;
$$;

drop index if exists public.idx_clients_phone;
create unique index if not exists idx_clients_phone_unique on public.clients(phone);

-- --------------------------------------------------------
-- 3. order_items: keep money exact
--
--    unit_price / line_total were INTEGER while products.price and
--    orders.total are NUMERIC(10,2). A 15% storewide discount on 299.00
--    stores 254 while the order subtotal says 254.15 — the invoice and
--    its lines disagreed. Widen to NUMERIC(10,2); existing integer
--    values cast losslessly.
-- --------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'order_items'
       and column_name = 'unit_price'
       and data_type = 'integer'
  ) then
    alter table public.order_items
      alter column unit_price type numeric(10,2) using unit_price::numeric(10,2);
    alter table public.order_items
      alter column line_total type numeric(10,2) using line_total::numeric(10,2);
  end if;
end;
$$;

-- --------------------------------------------------------
-- 4. place_order_rpc — atomic checkout (F3.1 / F3.3)
--
--    Properties:
--      * rows are locked with SELECT ... FOR UPDATE in slug order, so two
--        concurrent checkouts cannot both pass the stock check;
--      * the decrement itself is guarded (`and stock >= qty`), so even a
--        broken lock path can never drive stock negative;
--      * the coupon row is locked and used_count is incremented inside
--        the same transaction that creates the order → max_uses is a hard
--        limit, not a best-effort;
--      * prices, delivery fee and discount are recomputed from the
--        database; the client payload only supplies slugs and quantities;
--      * idempotency_key collisions (concurrent retries) return the order
--        that won instead of raising;
--      * everything is one transaction: any failure leaves no order, no
--        stock movement and no coupon increment.
--
--    Client statistics are NOT written here. lib/store.ts decides whether
--    the buyer is a guest or an authenticated customer and updates
--    `clients` accordingly; doing it twice double-counted order_count.
-- --------------------------------------------------------

-- Remove stale overloads left by earlier migrations (e.g. a
-- validate_coupon(text, numeric) added next to validate_coupon(text, integer)
-- makes the PostgREST RPC call ambiguous → 300). Runs before the canonical
-- definitions below so the result is deterministic on any live state.
do $$
declare
  -- Resolve by exact signature. pg_get_function_identity_arguments() embeds
  -- parameter names ("p_code text, p_subtotal numeric"), so string matching on
  -- it is fragile; to_regprocedure() returns NULL instead of raising when the
  -- signature is absent.
  v_canonical oid := to_regprocedure(
    'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)');
  v_int_coupon oid := to_regprocedure('public.validate_coupon(text,integer)');
  v_num_coupon oid := to_regprocedure('public.validate_coupon(text,numeric)');
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'place_order_rpc'
       and p.oid <> coalesce(v_canonical, 0)
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  -- Two overloads make the PostgREST RPC call ambiguous (HTTP 300).
  if v_int_coupon is not null and v_num_coupon is not null then
    drop function public.validate_coupon(text, integer) cascade;
  end if;
end;
$$;

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
set search_path = public, pg_temp
as $$
declare
  v_delivery_fee numeric(10,2);
  v_free_min_items integer;
  v_storewide_pct numeric(5,2);
  v_disc_start timestamptz;
  v_disc_end timestamptz;
  v_storewide boolean := false;
  v_items jsonb;
  v_cart jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_has_variant boolean;
  v_qty integer;
  v_base_price numeric(10,2);
  v_unit_price numeric(10,2);
  v_line_total numeric(10,2);
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_total_items integer := 0;
  v_coupon public.coupons%rowtype;
  v_order_id text;
  v_order_number text;
  v_tracking_token text;
  v_status text;
  v_rowcount integer;
begin
  -- ---------- input validation ----------
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'PANIER_VIDE: le panier est vide.'
      using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_customer_name), '') = '' then
    raise exception 'CLIENT_REQUIS: le nom du client est requis.' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_phone), '') = '' then
    raise exception 'TELEPHONE_REQUIS: le téléphone est requis.' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_address), '') = '' then
    raise exception 'ADRESSE_REQUISE: l''adresse est requise.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) as e
     where coalesce(btrim(e->>'slug'), '') = ''
        or coalesce(e->>'quantity', '') !~ '^[0-9]+$'
        or (e->>'quantity')::integer < 1
  ) then
    raise exception 'ARTICLE_INVALIDE: chaque ligne exige un slug et une quantité entière ≥ 1.'
      using errcode = 'P0001';
  end if;

  -- ---------- idempotency fast path ----------
  --    `exists` first: a plain SELECT INTO that finds nothing would reset
  --    every accumulator below to NULL.
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is not null
     and exists (
       select 1 from public.orders o where o.idempotency_key = p_idempotency_key
     ) then
    select o.id, o.order_number, o.tracking_token, o.subtotal, o.discount_total,
           o.delivery_fee, o.total, o.status
      into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount,
           v_delivery_fee, v_total, v_status
      from public.orders o
     where o.idempotency_key = p_idempotency_key;

    return query select v_order_id, v_order_number, v_tracking_token,
                        v_subtotal, v_discount, v_delivery_fee, v_total,
                        v_status;
    return;
  end if;

  -- ---------- settings (tolerate a missing singleton row) ----------
  v_delivery_fee := 22.00;
  v_free_min_items := 3;
  v_storewide_pct := 0;

  select coalesce(s.delivery_fee, 22.00),
         coalesce(s.free_delivery_min_items, 3),
         coalesce(s.storewide_discount_percent, 0),
         s.discount_start_date,
         s.discount_end_date
    into v_delivery_fee, v_free_min_items, v_storewide_pct, v_disc_start, v_disc_end
    from public.settings s
   where s.id = 1;

  if not found then
    v_delivery_fee := 22.00;
    v_free_min_items := 3;
    v_storewide_pct := 0;
  end if;

  v_storewide :=
    v_storewide_pct is not null
    and v_storewide_pct > 0
    and v_disc_start is not null
    and v_disc_end is not null
    and (now() at time zone 'Africa/Casablanca')::date between v_disc_start::date and v_disc_end::date;

  -- ---------- normalise the cart (dedupe identical lines, sort for locking) ----------
  select jsonb_agg(
           jsonb_build_object(
             'slug', g.slug,
             'size', g.size,
             'color', g.color,
             'quantity', g.qty
           )
           order by g.slug, g.size nulls first, g.color nulls first
         )
    into v_items
    from (
      select
        e->>'slug' as slug,
        nullif(btrim(coalesce(e->>'size', '')), '') as size,
        nullif(btrim(coalesce(e->>'color', '')), '') as color,
        sum((e->>'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_items) as e
      group by 1, 2, 3
    ) g;

  if v_items is null then
    raise exception 'PANIER_VIDE: le panier est vide.' using errcode = 'P0001';
  end if;

  -- ---------- pass 1: lock rows in a deterministic order, price, validate stock ----------
  --   Locks are taken in slug order so concurrent checkouts cannot deadlock
  --   against each other. Nothing is written in this pass.
  for v_line in
    select e from jsonb_array_elements(v_items) as e
  loop
    select p.* into v_product
      from public.products p
     where p.slug = v_line->>'slug'
       for update;

    if not found then
      raise exception 'PRODUIT_INTROUVABLE: %', v_line->>'slug' using errcode = 'P0001';
    end if;

    if not v_product.is_active then
      raise exception 'PRODUIT_INDISPONIBLE: %', v_product.title using errcode = 'P0001';
    end if;

    v_qty := (v_line->>'quantity')::integer;
    v_has_variant := (v_line->>'size') is not null or (v_line->>'color') is not null;
    v_variant := null;

    if v_has_variant then
      select pv.* into v_variant
        from public.product_variants pv
       where pv.product_id = v_product.id
         and pv.size is not distinct from (v_line->>'size')
         and pv.color is not distinct from (v_line->>'color')
         for update;

      if not found then
        raise exception 'VARIANTE_INTROUVABLE: %', v_product.title using errcode = 'P0001';
      end if;

      if v_variant.stock < v_qty then
        raise exception 'STOCK_INSUFFISANT: % (% restant)', v_product.title, v_variant.stock
          using errcode = 'P0001';
      end if;
    else
      if v_product.stock < v_qty then
        raise exception 'STOCK_INSUFFISANT: % (% restant)', v_product.title, v_product.stock
          using errcode = 'P0001';
      end if;
    end if;

    -- Storewide promotion excludes products already on sale (same rule as
    -- lib/pricing.ts getStorePrice()).
    v_base_price := v_product.price;
    if v_storewide
       and (v_product.original_price is null or v_product.original_price <= v_product.price) then
      v_base_price := greatest(0, round(v_product.price * (100 - v_storewide_pct) / 100.0, 2));
    end if;

    if v_has_variant then
      v_unit_price := v_base_price + coalesce(v_variant.price_adjustment, 0)::numeric(10,2);
    else
      v_unit_price := v_base_price;
    end if;

    v_line_total := round(v_unit_price * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;
    v_total_items := v_total_items + v_qty;

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'variant_id', case when v_has_variant then v_variant.id else null end,
      'slug', v_product.slug,
      'title', v_product.title,
      'size', v_line->>'size',
      'color', v_line->>'color',
      'quantity', v_qty,
      'unit_price', v_unit_price,
      'line_total', v_line_total
    );
  end loop;

  -- ---------- coupon (locked, so max_uses is a hard limit) ----------
  if nullif(btrim(coalesce(p_coupon_code, '')), '') is not null then
    select c.* into v_coupon
      from public.coupons c
     where c.code = lower(btrim(p_coupon_code))
       for update;

    if not found then
      raise exception 'COUPON_INVALIDE: ce code n''existe pas.' using errcode = 'P0001';
    end if;

    if not v_coupon.is_active then
      raise exception 'COUPON_INVALIDE: ce code n''est plus actif.' using errcode = 'P0001';
    end if;

    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
      raise exception 'COUPON_INVALIDE: ce code n''est pas encore valide.' using errcode = 'P0001';
    end if;

    if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
      raise exception 'COUPON_INVALIDE: ce code a expiré.' using errcode = 'P0001';
    end if;

    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'COUPON_EPUISE: ce code a atteint sa limite d''utilisation.'
        using errcode = 'P0001';
    end if;

    if v_subtotal < v_coupon.min_order then
      raise exception 'COUPON_MIN_ORDER: ce code s''applique à partir de % MAD.', v_coupon.min_order
        using errcode = 'P0001';
    end if;

    if v_coupon.type = 'percentage' then
      v_discount := floor(v_subtotal * v_coupon.value / 100.0);
    else
      v_discount := v_coupon.value;
    end if;

    if v_discount > v_subtotal then
      v_discount := v_subtotal;
    end if;
    if v_discount < 0 then
      v_discount := 0;
    end if;

    update public.coupons
       set used_count = used_count + 1,
           updated_at = now()
     where id = v_coupon.id;
  end if;

  -- ---------- delivery fee ----------
  if v_free_min_items > 0 and v_total_items >= v_free_min_items then
    v_delivery_fee := 0.00;
  end if;

  v_total := round(v_subtotal - v_discount + v_delivery_fee, 2);
  if v_total < 0 then
    v_total := 0;
  end if;

  -- ---------- create the order ----------
  v_order_id := 'ord-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_order_number := 'SAIS-' || upper(right(replace(v_order_id, '-', ''), 8));
  v_tracking_token := gen_random_uuid()::text;

  -- cart snapshot as the client sent it (slug/size/color/quantity)
  select jsonb_agg(
           jsonb_build_object(
             'slug', l->>'slug',
             'size', nullif(l->>'size', ''),
             'color', nullif(l->>'color', ''),
             'quantity', (l->>'quantity')::integer
           )
           order by l->>'slug', l->>'size', l->>'color'
         )
    into v_cart
    from jsonb_array_elements(v_lines) as l;

  begin
    insert into public.orders (
      id, auth_user_id, client_email, client_name, customer_name,
      phone, address, city, items, subtotal, discount_total, delivery_fee, total,
      status, note, tracking_token, order_number, idempotency_key
    )
    values (
      v_order_id,
      p_auth_user_id,
      nullif(btrim(coalesce(p_client_email, '')), ''),
      nullif(btrim(coalesce(p_client_name, '')), ''),
      btrim(p_customer_name),
      btrim(p_phone),
      btrim(p_address),
      coalesce(nullif(btrim(coalesce(p_city, '')), ''), 'Casablanca'),
      v_cart,
      v_subtotal,
      v_discount,
      v_delivery_fee,
      v_total,
      'en_attente',
      p_note,
      v_tracking_token,
      v_order_number,
      nullif(btrim(coalesce(p_idempotency_key, '')), '')
    );
  exception
    when unique_violation then
      -- Concurrent retry with the same idempotency key: return the winner.
      if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
        raise;
      end if;

      select o.id, o.order_number, o.tracking_token, o.subtotal, o.discount_total,
             o.delivery_fee, o.total, o.status
        into v_order_id, v_order_number, v_tracking_token, v_subtotal, v_discount,
             v_delivery_fee, v_total, v_status
        from public.orders o
       where o.idempotency_key = p_idempotency_key;

      if not found then
        raise;
      end if;

      return query select v_order_id, v_order_number, v_tracking_token,
                          v_subtotal, v_discount, v_delivery_fee, v_total,
                          v_status;
      return;
  end;

  -- ---------- pass 2: order lines + stock movement ----------
  for v_line in
    select e from jsonb_array_elements(v_lines) as e
  loop
    v_qty := (v_line->>'quantity')::integer;

    insert into public.order_items (
      order_id, product_id, variant, name_snapshot, unit_price, quantity, line_total
    )
    values (
      v_order_id,
      (v_line->>'product_id')::uuid,
      case
        when (v_line->>'size') is not null or (v_line->>'color') is not null
        then coalesce(v_line->>'size', '') || ' · ' || coalesce(v_line->>'color', '')
        else null
      end,
      v_line->>'title',
      (v_line->>'unit_price')::numeric(10,2),
      v_qty,
      (v_line->>'line_total')::numeric(10,2)
    );

    if (v_line->>'variant_id') is not null then
      update public.product_variants
         set stock = stock - v_qty,
             updated_at = now()
       where id = (v_line->>'variant_id')::uuid
         and stock >= v_qty;
    else
      update public.products
         set stock = stock - v_qty,
             updated_at = now()
       where id = (v_line->>'product_id')::uuid
         and stock >= v_qty;
    end if;

    get diagnostics v_rowcount = row_count;
    if v_rowcount = 0 then
      -- Should be unreachable (rows are locked above) — this is the guard
      -- that makes overselling impossible even if a lock is ever skipped.
      raise exception 'STOCK_INSUFFISANT: %', v_line->>'title' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.order_status_history (order_id, status, note)
  values (v_order_id, 'en_attente', 'Commande créée');

  return query select
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_subtotal,
    v_discount,
    v_delivery_fee,
    v_total,
    'en_attente'::text;
end;
$$;

-- --------------------------------------------------------
-- 5. Function privileges
--
--    The base migration revoked EXECUTE from `public`, which also removed
--    it for service_role. Every server action calls the RPC with the
--    service role, so the grant must be explicit.
-- --------------------------------------------------------
revoke execute on function public.place_order_rpc(
  uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text
) from anon, authenticated, public;

grant execute on function public.place_order_rpc(
  uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text
) to service_role;

-- validate_coupon stays executable by anon/authenticated: it is read-only
-- and used by the checkout preview through the SSR client. Grant whichever
-- signature survived the de-duplication above (integer on old projects,
-- numeric after 20261119_cleanup_cod_system.sql).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'validate_coupon'
  loop
    execute format('grant execute on function %s to anon, authenticated, service_role', r.sig);
  end loop;
end;
$$;

-- ========================================================================
-- End of P0 hardening
-- ========================================================================
