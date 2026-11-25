-- ========================================================================
-- SAIS Store — Cancellation and Returns Workflow
-- Migration: 20261124_02_cancellation_and_returns.sql
-- Description:
--   1. Adds coupon_code column to orders (for coupon reversal on cancellation).
--   2. Creates order_cancellations and order_returns tables (idempotency).
--   3. Creates public.cancel_order_rpc — atomic, idempotent cancellation:
--      - Authorizes: verified admin session OR verified order owner
--        (auth_user_id only; phone numbers never prove ownership).
--      - Validates status: only en_attente / confirmee are cancellable.
--      - Restores stock exactly once (reads inventory_ledger reservations).
--      - Writes cancellation ledger entries.
--      - Reverses coupon usage (decrements used_count, deletes redemption).
--      - Prevents double cancellation via idempotency key + status check.
--   4. Creates public.return_order_rpc — return after delivery.
--      - Only for livree orders. Admin only.
--      - Restock only returned quantities (partial or full).
--      - Writes return ledger entries.
--      - Prevents duplicate returns via idempotency key.
--
-- No existing data modified. Historical orders without ledger records are
-- handled gracefully (no stock restored — stock state marked unknown).
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. coupon_code on orders (nullable — historical orders keep NULL)
-- ------------------------------------------------------------------------
alter table public.orders
  add column if not exists coupon_code text;

-- ------------------------------------------------------------------------
-- 2. ORDER CANCELLATIONS table (idempotency record)
-- ------------------------------------------------------------------------
create table if not exists public.order_cancellations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null default 'annulee',
  restocked boolean not null default false,
  message text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_cancellations_order on public.order_cancellations(order_id);
create index if not exists idx_order_cancellations_idempotency on public.order_cancellations(idempotency_key)
  where idempotency_key is not null;

-- ------------------------------------------------------------------------
-- 3. ORDER RETURNS table (idempotency record)
-- ------------------------------------------------------------------------
create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null default 'returned',
  restocked boolean not null default false,
  message text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_returns_order on public.order_returns(order_id);
create index if not exists idx_order_returns_idempotency on public.order_returns(idempotency_key)
  where idempotency_key is not null;

-- ------------------------------------------------------------------------
-- 4. RLS for new tables
-- ------------------------------------------------------------------------
alter table public.order_cancellations enable row level security;
alter table public.order_returns enable row level security;

drop policy if exists "Admin manage order cancellations" on public.order_cancellations;
create policy "Admin manage order cancellations" on public.order_cancellations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin manage order returns" on public.order_returns;
create policy "Admin manage order returns" on public.order_returns
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.order_cancellations from public, anon, authenticated;

revoke all on public.order_returns from public, anon, authenticated;

-- ------------------------------------------------------------------------
-- 5. Helper: is_order_owner — SECURITY DEFINER
-- ------------------------------------------------------------------------
-- Ownership is established ONLY by auth_user_id (verified Supabase session).
-- Phone-based matching is intentionally excluded: shared, changed, or reused
-- phone numbers must never let one customer claim another customer's order.
-- Guests cannot claim via this helper; guest access is limited to the
-- token/phone tracking RPC and the order is never linked to an account by
-- phone alone.
create or replace function public.is_order_owner(p_order_id text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order_uid uuid;
  v_caller uuid := auth.uid();
begin
  -- Never trust a client-supplied identity when a real session exists.
  if v_caller is not null then
    if p_user_id is distinct from v_caller then
      return false;
    end if;
    p_user_id := v_caller;
  end if;

  select auth_user_id into v_order_uid
  from public.orders
  where id = p_order_id;

  if not found then
    return false;
  end if;

  -- Only a direct, verified auth_user_id link proves ownership.
  if v_order_uid is not null and v_order_uid = p_user_id then
    return true;
  end if;

  return false;
end;
$$;

-- Internal helper: only SECURITY DEFINER RPCs and the service role call it.
revoke execute on function public.is_order_owner(text, uuid) from public, anon, authenticated;
grant execute on function public.is_order_owner(text, uuid) to service_role;

-- ------------------------------------------------------------------------
-- 6. CANCEL ORDER RPC
-- ------------------------------------------------------------------------
create or replace function public.cancel_order_rpc(
  p_order_id text,
  p_actor_id uuid,
  p_actor_type text default 'admin',
  p_idempotency_key text default null,
  p_note text default null
)
returns table (
  order_id text,
  status text,
  restocked boolean,
  message text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order record;
  v_caller uuid := auth.uid();
  v_actor_id uuid;
  v_is_admin boolean;
  v_restocked boolean := false;
  v_reservation record;
  v_total_restored integer := 0;
  v_cancellation_key text;
  v_existing record;
  v_already_restocked boolean := false;
  v_deleted_redemptions integer := 0;
begin
  -- ====================================================================
  -- 0. IDENTITY: never trust a client-supplied actor when a real session
  --    exists. The service-role path (no auth.uid()) is only reachable by
  --    the trusted server which already ran requireAdmin()/ownership checks.
  -- ====================================================================
  v_actor_id := coalesce(v_caller, p_actor_id);

  -- ====================================================================
  -- 1. IDEMPOTENCY: same key AND same order only.
  -- ====================================================================
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select oc.order_id, oc.status, oc.restocked, oc.message
    into v_existing
    from public.order_cancellations oc
    where oc.idempotency_key = trim(p_idempotency_key)
      and oc.order_id = p_order_id
    limit 1;

    if found then
      return query select
        v_existing.order_id,
        v_existing.status,
        v_existing.restocked,
        v_existing.message;
      return;
    end if;
  end if;

  -- ====================================================================
  -- 2. LOAD ORDER (FOR UPDATE — prevents concurrent cancellation)
  -- ====================================================================
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'COMMANDE_INTROUVABLE: Commande introuvable.';
  end if;

  -- ====================================================================
  -- 3. AUTHORIZATION
  -- ====================================================================
  v_is_admin := public.is_admin();

  if v_caller is not null then
    -- Direct authenticated call (browser → PostgREST with a user JWT).
    if p_actor_type = 'customer' then
      if not public.is_order_owner(p_order_id, v_caller) and not v_is_admin then
        raise exception 'NON_AUTORISE: Vous ne pouvez pas annuler cette commande.';
      end if;
    elsif p_actor_type = 'admin' then
      if not v_is_admin then
        raise exception 'NON_AUTORISE: Privilèges admin requis.';
      end if;
    else
      raise exception 'ACTEUR_INVALIDE: Type d''acteur invalide.';
    end if;
  else
    -- service_role path: authorization was performed server-side. Still
    -- require an explicit admin actor so an accidental customer call through
    -- the privileged client cannot cancel an arbitrary order.
    if p_actor_type <> 'admin' then
      raise exception 'NON_AUTORISE: Annulation via service_role réservée aux administrateurs.';
    end if;
    if v_actor_id is null then
      raise exception 'ACTEUR_REQUIS: Identifiant de l''acteur requis.';
    end if;
  end if;

  -- ====================================================================
  -- 4. VALIDATE STATUS — cancellable only before shipment
  -- ====================================================================
  if v_order.status = 'annulee' then
    raise exception 'DEJA_ANNULEE: Cette commande est déjà annulée.';
  end if;

  if v_order.status = 'livree' then
    raise exception 'LIVREE: Impossible d''annuler une commande déjà livrée. Utilisez le workflow de retour.';
  end if;

  if v_order.status = 'expediee' then
    raise exception 'EXPEDIEE: Impossible d''annuler une commande déjà expédiée.';
  end if;

  -- en_attente and confirmee are cancellable

  -- ====================================================================
  -- 5. DOUBLE-RESTOCK GUARD — cancellation ledger entries are the marker
  -- ====================================================================
  select exists (
    select 1 from public.inventory_ledger
    where reference_type = 'order'
      and reference_id = p_order_id
      and event_type = 'cancellation'
  ) into v_already_restocked;

  if v_already_restocked then
    raise exception 'DEJA_RESTOCKE: Le stock de cette commande a déjà été restitué.';
  end if;

  -- ====================================================================
  -- 6. RESTOCK — exactly once, driven by reservation ledger entries
  -- ====================================================================
  for v_reservation in
    select product_id, variant_id, quantity_change
    from public.inventory_ledger
    where reference_type = 'order'
      and reference_id = p_order_id
      and event_type = 'reservation'
      and quantity_change < 0
  loop
    if v_reservation.variant_id is not null then
      update public.product_variants
      set stock = stock + (-v_reservation.quantity_change), updated_at = now()
      where id = v_reservation.variant_id;
    else
      update public.products
      set stock = stock + (-v_reservation.quantity_change), updated_at = now()
      where id = v_reservation.product_id;
    end if;

    v_total_restored := v_total_restored + (-v_reservation.quantity_change);
  end loop;

  if v_total_restored > 0 then
    v_restocked := true;
  end if;

  -- Write one cancellation ledger row per reservation. A fresh UUID per row
  -- avoids the unique-idempotency-key collision that a single shared key
  -- would cause on multi-item orders; the guard above prevents a second run.
  insert into public.inventory_ledger (
    product_id, variant_id, quantity_change, event_type,
    reference_type, reference_id, idempotency_key,
    actor_id, actor_type, created_at
  )
  select
    product_id, variant_id, -quantity_change, 'cancellation',
    'order', p_order_id,
    'cancellation:' || p_order_id || ':' || gen_random_uuid()::text,
    v_actor_id, p_actor_type, now()
  from public.inventory_ledger
  where reference_type = 'order'
    and reference_id = p_order_id
    and event_type = 'reservation'
    and quantity_change < 0;

  -- ====================================================================
  -- 7. REVERSE COUPON USAGE — only when a redemption actually existed
  -- ====================================================================
  if v_order.coupon_code is not null then
    -- `cr` alias: the function's OUT parameter `order_id` would otherwise
    -- make an unqualified reference ambiguous (42702).
    delete from public.coupon_redemptions cr
    where cr.order_id = p_order_id;

    get diagnostics v_deleted_redemptions = row_count;

    if v_deleted_redemptions > 0 then
      update public.coupons
      set used_count = greatest(0, used_count - 1), updated_at = now()
      where lower(code) = lower(v_order.coupon_code);
    end if;
  end if;

  -- ====================================================================
  -- 8. UPDATE ORDER STATUS + HISTORY
  -- ====================================================================
  update public.orders
  set status = 'annulee', updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, note, created_at)
  values (
    p_order_id, 'annulee',
    coalesce(left(p_note, 1000), 'Commande annulée — stock restitué.'),
    now()
  );

  -- ====================================================================
  -- 9. RECORD CANCELLATION (idempotency)
  -- ====================================================================
  insert into public.order_cancellations (
    order_id, status, restocked, message, idempotency_key, created_at
  ) values (
    p_order_id, 'annulee', v_restocked,
    coalesce(p_note, 'Commande annulée.'),
    nullif(trim(p_idempotency_key), ''),
    now()
  );

  return query select
    p_order_id, 'annulee', v_restocked,
    'Commande annulée.'::text;
end;
$$;

revoke execute on function public.cancel_order_rpc(text, uuid, text, text, text) from public, anon;
grant execute on function public.cancel_order_rpc(text, uuid, text, text, text) to authenticated, service_role;

-- ------------------------------------------------------------------------
-- 7. RETURN ORDER RPC (after delivery, admin only)
-- ------------------------------------------------------------------------
create or replace function public.return_order_rpc(
  p_order_id text,
  p_actor_id uuid,
  p_return_items jsonb default '[]'::jsonb,
  p_idempotency_key text default null,
  p_note text default null
)
returns table (
  order_id text,
  status text,
  restocked boolean,
  message text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order record;
  v_caller uuid := auth.uid();
  v_actor_id uuid;
  v_existing record;
  v_total_returned integer := 0;
  v_item jsonb;
  v_i integer;
  v_qty integer;
  v_product_id uuid;
  v_variant_id uuid;
  v_ordered_qty integer;
  v_oi record;
  v_parsed_color text;
  v_parsed_size text;
  v_message text;
  v_cumulative jsonb := '{}'::jsonb;
  v_cum_key text;
begin
  -- ====================================================================
  -- 0. IDENTITY — never trust a client-supplied actor when a session exists
  -- ====================================================================
  v_actor_id := coalesce(v_caller, p_actor_id);

  -- ====================================================================
  -- 1. IDEMPOTENCY — same key AND same order only
  -- ====================================================================
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select orr.order_id, orr.status, orr.restocked, orr.message
    into v_existing
    from public.order_returns orr
    where orr.idempotency_key = trim(p_idempotency_key)
      and orr.order_id = p_order_id
    limit 1;

    if found then
      return query select
        v_existing.order_id,
        v_existing.status,
        v_existing.restocked,
        v_existing.message;
      return;
    end if;
  end if;

  -- ====================================================================
  -- 2. LOAD ORDER (FOR UPDATE)
  -- ====================================================================
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'COMMANDE_INTROUVABLE: Commande introuvable.';
  end if;

  -- ====================================================================
  -- 3. AUTHORIZATION — admin only
  -- ====================================================================
  if v_caller is not null then
    if not public.is_admin() then
      raise exception 'NON_AUTORISE: Privilèges admin requis pour un retour.';
    end if;
  else
    -- service_role path: the server already ran requireAdmin().
    if v_actor_id is null then
      raise exception 'ACTEUR_REQUIS: Identifiant de l''acteur requis.';
    end if;
  end if;

  -- ====================================================================
  -- 4. VALIDATE STATUS — only delivered orders can be returned
  -- ====================================================================
  if v_order.status <> 'livree' then
    raise exception 'NON_LIVREE: Seules les commandes livrées peuvent être retournées.';
  end if;

  -- ====================================================================
  -- 5. PROCESS RETURN ITEMS
  -- ====================================================================
  if p_return_items is null or jsonb_typeof(p_return_items) <> 'array' then
    raise exception 'RETOUR_INVALIDE: Liste des articles retournés invalide.';
  end if;

  if jsonb_array_length(p_return_items) = 0 then
    -- Full return: derive quantities from the order's immutable line items.
    -- `oi` alias: the OUT parameter `order_id` makes an unqualified
    -- reference ambiguous (42702).
    for v_oi in
      select oi.product_id, oi.variant, oi.quantity
      from public.order_items oi
      where oi.order_id = p_order_id
    loop
      v_product_id := v_oi.product_id;
      v_variant_id := null;

      if v_oi.variant is not null and position(' / ' in v_oi.variant) > 0 then
        v_parsed_color := split_part(v_oi.variant, ' / ', 1);
        v_parsed_size := split_part(v_oi.variant, ' / ', 2);

        select pv.id into v_variant_id
        from public.product_variants pv
        where pv.product_id = v_oi.product_id
          and pv.color = v_parsed_color
          and pv.size = v_parsed_size
        limit 1;
      end if;

      if v_variant_id is not null then
        update public.product_variants
        set stock = stock + v_oi.quantity, updated_at = now()
        where id = v_variant_id;
      else
        update public.products
        set stock = stock + v_oi.quantity, updated_at = now()
        where id = v_product_id;
      end if;

      insert into public.inventory_ledger (
        product_id, variant_id, quantity_change, event_type,
        reference_type, reference_id, idempotency_key,
        actor_id, actor_type, created_at
      ) values (
        v_product_id, v_variant_id, v_oi.quantity, 'return',
        'order', p_order_id,
        'return:' || p_order_id || ':' || gen_random_uuid()::text,
        v_actor_id, 'admin', now()
      );

      v_total_returned := v_total_returned + v_oi.quantity;
    end loop;
  else
    for v_i in 0 .. jsonb_array_length(p_return_items) - 1 loop
      select elem into v_item
      from jsonb_array_elements(p_return_items) with ordinality arr(elem, ord)
      where arr.ord = v_i + 1;

      v_qty := case
        when (v_item->>'quantity') ~ '^[0-9]{1,9}$' then (v_item->>'quantity')::integer
        else 0
      end;
      if v_qty <= 0 then
        raise exception 'QUANTITE_INVALIDE: Quantité retournée invalide.';
      end if;

      v_product_id := nullif(v_item->>'product_id', '')::uuid;
      v_variant_id := nullif(v_item->>'variant_id', '')::uuid;

      if v_variant_id is not null then
        select pv.product_id into v_product_id
        from public.product_variants pv
        where pv.id = v_variant_id;

        if not found then
          raise exception 'VARIANTE_INTROUVABLE: Variante retournée introuvable.';
        end if;
      end if;

      if v_product_id is null then
        raise exception 'ARTICLE_INVALIDE: Produit retourné manquant.';
      end if;

      -- A variant product must be returned at variant level, never at
      -- product level (that would restore stock to the wrong source).
      if v_variant_id is null
         and exists (select 1 from public.product_variants where product_id = v_product_id) then
        raise exception 'VARIANTE_REQUISE: Précisez la variante retournée.';
      end if;

      -- The item must belong to this order (`oi` alias: OUT parameter
      -- `order_id` would otherwise be ambiguous).
      select coalesce(sum(oi.quantity), 0) into v_ordered_qty
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.product_id = v_product_id;

      if v_ordered_qty = 0 then
        raise exception 'ARTICLE_HORS_COMMANDE: Cet article n''appartient pas à la commande.';
      end if;

      -- Cumulative guard: prevent the same (product, variant) from being
      -- returned more than ordered across multiple lines in p_return_items.
      v_cum_key := coalesce(v_product_id::text, '') || '|' || coalesce(v_variant_id::text, '');
      if v_cumulative ? v_cum_key then
        if (v_cumulative->v_cum_key)::integer + v_qty > v_ordered_qty then
          raise exception 'QUANTITE_INVALIDE: Quantité retournée supérieure à la quantité commandée.';
        end if;
      else
        if v_qty > v_ordered_qty then
          raise exception 'QUANTITE_INVALIDE: Quantité retournée supérieure à la quantité commandée.';
        end if;
      end if;

      -- Update cumulative tracker
      if v_cumulative ? v_cum_key then
        v_cumulative := v_cumulative || jsonb_build_object(v_cum_key, (v_cumulative->v_cum_key)::integer + v_qty);
      else
        v_cumulative := v_cumulative || jsonb_build_object(v_cum_key, v_qty);
      end if;

      if v_variant_id is not null then
        update public.product_variants
        set stock = stock + v_qty, updated_at = now()
        where id = v_variant_id;
      else
        update public.products
        set stock = stock + v_qty, updated_at = now()
        where id = v_product_id;
      end if;

      insert into public.inventory_ledger (
        product_id, variant_id, quantity_change, event_type,
        reference_type, reference_id, idempotency_key,
        actor_id, actor_type, created_at
      ) values (
        v_product_id, v_variant_id, v_qty, 'return',
        'order', p_order_id,
        'return:' || p_order_id || ':' || gen_random_uuid()::text,
        v_actor_id, 'admin', now()
      );

      v_total_returned := v_total_returned + v_qty;
    end loop;
  end if;

  -- ====================================================================
  -- 6. UPDATE ORDER STATUS + HISTORY
  -- ====================================================================
  update public.orders
  set status = 'returned', updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, note, created_at)
  values (
    p_order_id, 'returned',
    coalesce(left(p_note, 1000), 'Retour enregistré — stock restitué.'),
    now()
  );

  v_message := case
    when v_total_returned > 0 then 'Retour enregistré — stock restitué.'
    else 'Retour enregistré (aucun article à restituer).'
  end;

  -- ====================================================================
  -- 7. RECORD RETURN (idempotency)
  -- ====================================================================
  insert into public.order_returns (
    order_id, status, restocked, message, idempotency_key, created_at
  ) values (
    p_order_id, 'returned', v_total_returned > 0,
    v_message,
    nullif(trim(p_idempotency_key), ''),
    now()
  );

  return query select
    p_order_id, 'returned', v_total_returned > 0, v_message;
end;
$$;

revoke execute on function public.return_order_rpc(text, uuid, jsonb, text, text) from public, anon;
grant execute on function public.return_order_rpc(text, uuid, jsonb, text, text) to authenticated, service_role;

-- Explicit direct-table grants for the service role (server-side admin client).
grant all on public.order_cancellations to service_role;
grant all on public.order_returns to service_role;

-- ========================================================================
-- END
-- ========================================================================
