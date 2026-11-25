-- ========================================================================
-- SAIS STORE — REMOTE SUPABASE REMEDIATION SCRIPT
-- Target Project: dlkrjwsapwsjnqwkzjes
-- PostgreSQL: 14.18 (compatible — no PG 15/16-specific features used)
--
-- EXECUTION: Copy-paste this entire file into the Supabase Dashboard SQL Editor
--            (https://supabase.com/dashboard/project/dlkrjwsapwsjnqwkzjes/sql)
--            and click "Run".
--
-- SAFETY:
--   - No DROP TABLE, TRUNCATE, or DELETE of existing business data.
--   - All changes are additive (CREATE IF NOT EXISTS) or corrective (CREATE OR REPLACE).
--   - Existing data (products, orders, profiles, coupons, settings) is preserved.
--   - New columns (auth_user_id, coupon_code, redeemed_phone) are nullable.
--   - If any statement fails, the transaction rolls back (ON_ERROR_STOP equivalent).
--
-- PRECONDITION: The base schema (20261122) and customer_addresses (20261123)
--               must already be applied. This script only applies the 8 new
--               migrations (20261124_01 through 20261124_08).
-- ========================================================================

-- ========================================================================
-- PRECONDITION CHECKS
-- ========================================================================

DO $$
BEGIN
    -- Verify base tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: orders table does not exist. Apply base migration 20261122 first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: products table does not exist. Apply base migration 20261122 first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: coupons table does not exist. Apply base migration 20261122 first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: profiles table does not exist. Apply base migration 20261122 first.';
    END IF;
    -- Verify auth schema exists (Supabase provides this)
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: auth schema does not exist. This must be a Supabase project.';
    END IF;
    -- Verify auth.uid() function exists
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: auth.uid() function does not exist. This must be a Supabase project.';
    END IF;
    RAISE NOTICE 'PRECONDITION CHECKS PASSED';
END;
$$;

-- ========================================================================
-- MIGRATION 01: Inventory Ledger, Order-User Links, Coupon Redemptions
-- ========================================================================
-- (Full content of 20261124_01_inventory_ledger_and_order_links.sql)
-- Includes: auth_user_id on orders, inventory_ledger table, coupon_redemptions table,
-- status constraint expansion, RLS policies, grants, coupon_redemption_count_for_user function

-- BEGIN: 20261124_01_inventory_ledger_and_order_links.sql
-- ========================================================================
-- SAIS Store — Inventory Ledger, Order-User Links, Coupon Redemptions
-- Migration: 20261124_01_inventory_ledger_and_order_links.sql
-- Description:
--   1. Adds auth_user_id to orders (nullable) so authenticated customers can
--      claim their guest orders and RLS can isolate orders per user.
--   2. Creates public.inventory_ledger — append-only, immutable stock
--      movement log with idempotency (partial unique index on the key
--      because NULLs are not distinct under a normal UNIQUE constraint).
--   3. Creates public.coupon_redemptions — per-order, per-user coupon
--      usage records with uniqueness on (coupon_id, order_id) and
--      (coupon_id, redeemed_by) to enforce per-user limits.
--   4. Adds 'returned' and 'refunded' to the orders.status check constraint
--      (expand -> existing rows keep 'en_attente' etc.; no data rewritten).
--   5. Grants + RLS for the new tables (least privilege).
--
-- Strategy: expand → migrate → verify → contract. No existing data is
-- modified or deleted. No column is dropped.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. auth_user_id on orders (nullable — historical orders keep NULL)
-- ------------------------------------------------------------------------
alter table public.orders
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_orders_auth_user_id on public.orders(auth_user_id)
  where auth_user_id is not null;

-- ------------------------------------------------------------------------
-- 2. INVENTORY LEDGER (append-only, immutable stock movements)
-- ------------------------------------------------------------------------
create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity_change integer not null,           -- positive = in, negative = out
  event_type text not null check (event_type in (
    'reservation', 'restock', 'cancellation', 'return', 'adjustment', 'seed'
  )),
  reference_type text check (reference_type in ('order', 'adjustment', 'seed')),
  reference_id text,                          -- order_id or adjustment id
  idempotency_key text not null,              -- unique per operation (see partial index below)
  actor_id uuid references auth.users(id) on delete set null,  -- admin or system
  actor_type text check (actor_type in ('admin', 'customer', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_ledger_product
  on public.inventory_ledger(product_id, created_at);
create index if not exists idx_inventory_ledger_variant
  on public.inventory_ledger(variant_id, created_at);
create index if not exists idx_inventory_ledger_order
  on public.inventory_ledger(reference_type, reference_id)
  where reference_type = 'order';
create index if not exists idx_inventory_ledger_idempotency
  on public.inventory_ledger(idempotency_key);

-- Partial unique index: idempotency_key must be unique only when non-null.
-- A normal UNIQUE(idempotency_key) would allow multiple NULL rows.
create unique index if not exists ux_inventory_ledger_idempotency_key_nonnull
  on public.inventory_ledger(idempotency_key)
  where idempotency_key is not null;

-- ------------------------------------------------------------------------
-- 3. COUPON REDEMPTIONS (per-order + per-user uniqueness)
-- ------------------------------------------------------------------------
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id text not null references public.orders(id) on delete cascade,
  redeemed_by uuid references auth.users(id) on delete set null,  -- NULL = guest
  redeemed_at timestamptz not null default now(),
  discount_amount numeric(10,2) not null check (discount_amount >= 0)
);

-- Same coupon cannot be applied twice to the same order.
create unique index if not exists ux_coupon_redemptions_coupon_order
  on public.coupon_redemptions(coupon_id, order_id);

-- Per-user limit support: same (coupon, user) pair can repeat up to per_user_limit.
-- The application enforces the count; this index prevents exact duplicates.
create unique index if not exists ux_coupon_redemptions_coupon_user_order
  on public.coupon_redemptions(coupon_id, redeemed_by, order_id)
  where redeemed_by is not null;

create index if not exists idx_coupon_redemptions_coupon
  on public.coupon_redemptions(coupon_id);
create index if not exists idx_coupon_redemptions_user
  on public.coupon_redemptions(redeemed_by)
  where redeemed_by is not null;

-- ------------------------------------------------------------------------
-- 4. Expand order status check constraint to include returned/refunded
-- ------------------------------------------------------------------------
-- Existing rows keep their current values; only new inserts/updates are
-- constrained by the new check.
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'en_attente', 'confirmee', 'expediee', 'livree',
    'annulee', 'returned', 'refunded'
  ));

-- Also expand order_status_history to match.
alter table public.order_status_history
  drop constraint if exists order_status_history_status_check;

alter table public.order_status_history
  add constraint order_status_history_status_check
  check (status in (
    'en_attente', 'confirmee', 'expediee', 'livree',
    'annulee', 'returned', 'refunded'
  ));

-- ------------------------------------------------------------------------
-- 5. RLS — new tables
-- ------------------------------------------------------------------------
alter table public.inventory_ledger enable row level security;
alter table public.coupon_redemptions enable row level security;

-- Inventory ledger: no public or customer access. Admin only.
drop policy if exists "Admin manage inventory ledger" on public.inventory_ledger;
create policy "Admin manage inventory ledger" on public.inventory_ledger
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Coupon redemptions: no public select. Admin full; a customer can only
-- see redemptions tied to their own verified account (redeemed_by or an
-- order already linked to their auth_user_id).
drop policy if exists "Admin manage coupon redemptions" on public.coupon_redemptions;
create policy "Admin manage coupon redemptions" on public.coupon_redemptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Customer read own coupon redemptions" on public.coupon_redemptions;
create policy "Customer read own coupon redemptions" on public.coupon_redemptions
  for select to authenticated
  using (
    redeemed_by = auth.uid()
    or exists (
      select 1 from public.orders o
      where o.id = coupon_redemptions.order_id
        and o.auth_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------
-- 6. GRANTS — least privilege
-- ------------------------------------------------------------------------
-- No direct table access for public, anon, or authenticated. All writes go
-- through SECURITY DEFINER RPCs (place_order_rpc, cancel_order_rpc,
-- return_order_rpc) which run as the function owner. Customers must never
-- insert, update, or delete ledger or redemption records directly.
revoke all on public.inventory_ledger from public, anon, authenticated;
revoke all on public.coupon_redemptions from public, anon, authenticated;

-- service_role is the only role allowed to touch these tables directly
-- (server-side admin client). Explicit grant so the privilege does not depend
-- on Supabase default privileges.
grant all on public.inventory_ledger to service_role;
grant all on public.coupon_redemptions to service_role;

-- ------------------------------------------------------------------------
-- 7. SECURITY DEFINER helper: is_coupon_redeemed_by_user
-- ------------------------------------------------------------------------
create or replace function public.coupon_redemption_count_for_user(
  p_coupon_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_caller uuid := auth.uid();
  v_target uuid := p_user_id;
begin
  -- A signed-in caller may only count their own redemptions (admins may
  -- count anyone). Without this, any authenticated user could probe another
  -- customer's coupon usage by passing their user id.
  if v_caller is not null then
    if p_user_id is distinct from v_caller and not public.is_admin() then
      raise exception 'NON_AUTORISE: Vous ne pouvez consulter que vos propres utilisations.';
    end if;
    v_target := v_caller;
  end if;

  select count(*) into v_count
  from public.coupon_redemptions
  where coupon_id = p_coupon_id
    and redeemed_by = v_target;
  return v_count;
end;
$$;

revoke execute on function public.coupon_redemption_count_for_user(uuid, uuid) from public, anon;
grant execute on function public.coupon_redemption_count_for_user(uuid, uuid) to authenticated, service_role;

-- ========================================================================
-- END
-- ========================================================================

-- END: 20261124_01_inventory_ledger_and_order_links.sql

-- ========================================================================
-- MIGRATION 02: Cancellation and Returns Workflow
-- ========================================================================
-- (Full content of 20261124_02_cancellation_and_returns.sql)
-- Includes: coupon_code on orders, order_cancellations, order_returns tables,
-- is_order_owner, cancel_order_rpc, return_order_rpc

-- BEGIN: 20261124_02_cancellation_and_returns.sql
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

-- END: 20261124_02_cancellation_and_returns.sql

-- ========================================================================
-- MIGRATION 03: Coupon Per-User Limits
-- ========================================================================
-- (Full content of 20261124_03_coupon_per_user_limits.sql)
-- Includes: redeemed_phone on coupon_redemptions, 4-arg validate_coupon,
-- drops old 2-arg overload

-- BEGIN: 20261124_03_coupon_per_user_limits.sql
-- ========================================================================
-- SAIS Store — Coupon Per-User Limits
-- Migration: 20261124_03_coupon_per_user_limits.sql
-- Description:
--   1. Adds redeemed_phone to coupon_redemptions (guest identity for
--      per-user limit enforcement when no auth.user exists).
--   2. Updates public.validate_coupon to accept optional p_user_id and
--      p_phone, enforcing per_user_limit against coupon_redemptions.
--   3. Re-grants EXECUTE.
--
-- For guest customers (no auth user), the normalized phone number is the
-- identity used for coupon per-user limits only. It is NOT used to prove
-- ownership of an order or to grant account access.
--
-- No existing data modified.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. redeemed_phone on coupon_redemptions (guest identity)
-- ------------------------------------------------------------------------
alter table public.coupon_redemptions
  add column if not exists redeemed_phone text;

create index if not exists idx_coupon_redemptions_phone
  on public.coupon_redemptions(redeemed_phone)
  where redeemed_phone is not null;

-- ------------------------------------------------------------------------
-- 2. Updated validate_coupon with per-user/per-phone limit enforcement
-- ------------------------------------------------------------------------
create or replace function public.validate_coupon(
  p_code text,
  p_subtotal numeric,
  p_user_id uuid default null,
  p_phone text default null
)
returns table (valid boolean, discount_amount numeric(10,2), message text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_coupon record;
  v_discount numeric(10,2);
  v_user_count integer := 0;
  v_caller uuid := auth.uid();
begin
  -- Never let a signed-in caller check another user's redemption count.
  if v_caller is not null then
    p_user_id := v_caller;
    p_phone := null;
  end if;

  select * into v_coupon
  from public.coupons
  where code = lower(trim(p_code))
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
    and (max_uses is null or used_count < max_uses)
  limit 1;

  if not found then
    return query select false, 0.00::numeric(10,2),
      'Ce code de réduction n’existe pas ou n’est plus valide.'::text;
    return;
  end if;

  if p_subtotal < v_coupon.min_order then
    return query select false, 0.00::numeric(10,2),
      ('Ce code s’applique uniquement à partir de ' || v_coupon.min_order || ' MAD.')::text;
    return;
  end if;

  -- Per-user limit: count prior redemptions for this user/coupon
  if p_user_id is not null then
    select count(*) into v_user_count
    from public.coupon_redemptions
    where coupon_id = v_coupon.id
      and redeemed_by = p_user_id;
  elsif p_phone is not null then
    -- Guest: count prior redemptions by normalized phone, preferring the
    -- dedicated redeemed_phone column and falling back to the order phone
    -- for historical rows.
    select count(*) into v_user_count
    from public.coupon_redemptions cr
    left join public.orders o on o.id = cr.order_id
    where cr.coupon_id = v_coupon.id
      and coalesce(cr.redeemed_phone, o.phone) = p_phone;
  end if;

  if v_coupon.per_user_limit is not null and v_user_count >= v_coupon.per_user_limit then
    return query select false, 0.00::numeric(10,2),
      'Ce code de réduction a déjà été utilisé le nombre maximal de fois pour votre compte.'::text;
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

-- ------------------------------------------------------------------------
-- 3. Remove the legacy 2-argument overload, then re-grant EXECUTE.
--
-- Keeping both validate_coupon(text, numeric) and
-- validate_coupon(text, numeric, uuid, text DEFAULT NULL, ...) would make a
-- two-argument call ambiguous and could silently select the old function
-- that does NOT enforce per-user limits. The 4-argument function keeps
-- defaults, so existing two-argument call sites still work.
-- ------------------------------------------------------------------------
drop function if exists public.validate_coupon(text, numeric);

revoke execute on function public.validate_coupon(text, numeric, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.validate_coupon(text, numeric, uuid, text) to anon, authenticated, service_role;

-- ========================================================================
-- END
-- ========================================================================

-- END: 20261124_03_coupon_per_user_limits.sql

-- ========================================================================
-- MIGRATION 04: place_order_rpc Integrity Rewrite
-- ========================================================================
-- (Full content of 20261124_04_place_order_rpc_integrity.sql)
-- Includes: duplicate aggregation, per-line pricing, stock guards, atomic idempotency,
-- coupon consumption with row locking

-- BEGIN: 20261124_04_place_order_rpc_integrity.sql
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

-- END: 20261124_04_place_order_rpc_integrity.sql

-- ========================================================================
-- MIGRATION 05: Database-Backed Rate Limiting
-- ========================================================================
-- (Full content of 20261124_05_rate_limiting.sql)
-- Includes: rate_limits table, check_rate_limit, cleanup_rate_limits

-- BEGIN: 20261124_05_rate_limiting.sql
-- ========================================================================
-- SAIS Store — Database-Backed Rate Limiting
-- Migration: 20261124_05_rate_limiting.sql
-- Description:
--   Creates public.rate_limits — a fixed-window counter table backed by
--   PostgreSQL (atomic UPSERT), replacing the in-memory Map in
--   lib/security/rateLimit.ts so limits survive restarts and work across
--   server instances.
--
-- Fixed-window: each row is (identifier, window_start, count). A request
-- atomically increments the count for the current window; when the count
-- exceeds max, the request is rejected. Windows roll over by time.
--
-- Strategy: expand only. No existing tables modified.
-- ========================================================================

create table if not exists public.rate_limits (
  identifier text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (identifier, window_start)
);

create index if not exists idx_rate_limits_identifier_window
  on public.rate_limits(identifier, window_start);

-- ------------------------------------------------------------------------
-- RLS — rate_limits is internal. No public, no customer access.
-- Admin can inspect (read-only) for operations monitoring.
-- ------------------------------------------------------------------------
alter table public.rate_limits enable row level security;

drop policy if exists "Admin read rate limits" on public.rate_limits;
create policy "Admin read rate limits" on public.rate_limits
  for select to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE policy for authenticated or anon — the rate-limit
-- function (SECURITY DEFINER) performs the UPSERT with service_role-like
-- privileges via the function owner. Direct table writes are blocked.
revoke all on public.rate_limits from public, anon, authenticated;

-- ------------------------------------------------------------------------
-- SECURITY DEFINER: atomic check-and-increment.
-- Returns {allowed: boolean, retry_after_ms: integer|null}.
-- ------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_identifier text,
  p_max integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after_ms integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_row record;
begin
  -- Clamp caller-supplied parameters so an exposed call cannot create huge
  -- windows or bypass limits with absurd values.
  p_max := greatest(1, least(coalesce(p_max, 10), 100000));
  p_window_ms := greatest(1000, least(coalesce(p_window_ms, 60000), 86400000));

  -- Align window start to a fixed boundary (epoch + multiple of window_ms).
  -- floor() is required: bigint / numeric does not truncate, so without it
  -- every request would land in its own window and never be limited.
  v_window_start := to_timestamp((
    floor(extract(epoch from v_now) / (p_window_ms / 1000.0)) * (p_window_ms / 1000.0)
  )::double precision);
  v_window_end := v_window_start + (p_window_ms * interval '1 millisecond');

  -- Atomic upsert: insert new row or increment existing row for this window.
  insert into public.rate_limits (identifier, window_start, count, updated_at)
  values (p_identifier, v_window_start, 1, v_now)
  on conflict (identifier, window_start) do update
  set count = rate_limits.count + 1,
      updated_at = v_now
  returning count, window_start into v_row;

  if v_row.count > p_max then
    return query select false,
      greatest(0, ceil(extract(epoch from (v_window_end - v_now)) * 1000.0))::integer;
  else
    return query select true, null::integer;
  end if;
end;
$$;

-- The rate limiter is an internal server-side primitive. Only the trusted
-- service role may call it: granting it to anon/authenticated would let any
-- visitor poison another phone number's counter (unlimited writes to
-- rate_limits) and bypass the configured window/max.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Explicit direct-table grant for the service role (server-side admin client).
grant all on public.rate_limits to service_role;

-- ------------------------------------------------------------------------
-- Cleanup function (admin only — removes expired windows).
-- ------------------------------------------------------------------------
create or replace function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer := 0;
  v_caller uuid := auth.uid();
begin
  -- Authorization: a signed-in caller must be an admin. The service_role
  -- path (no auth.uid()) is the trusted server/cron and is allowed.
  if v_caller is not null and not public.is_admin() then
    raise exception 'NON_AUTORISE: Privilèges admin requis pour le nettoyage des limites de débit.';
  end if;

  delete from public.rate_limits
  where window_start < now() - interval '7 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Admin sessions (authenticated + is_admin) and the service role may run it.
-- Anonymous callers are explicitly excluded.
revoke all on function public.cleanup_rate_limits() from public, anon;
grant execute on function public.cleanup_rate_limits() to authenticated, service_role;

-- ========================================================================
-- END
-- ========================================================================

-- END: 20261124_05_rate_limiting.sql

-- ========================================================================
-- MIGRATION 06: Revoke Anon Tracking RPC
-- ========================================================================
-- (Full content of 20261124_06_revoke_anon_tracking_rpc.sql)
-- Revokes anon/authenticated on get_order_for_tracking, grants service_role only

-- BEGIN: 20261124_06_revoke_anon_tracking_rpc.sql
-- ========================================================================
-- SAIS Store — Revoke Anon Execute on get_order_for_tracking
-- Migration: 20261124_06_revoke_anon_tracking_rpc.sql
-- Description:
--   get_order_for_tracking is defined in the already-applied migration
--   20261122_sais_store_production.sql with EXECUTE granted to anon,
--   authenticated, and service_role.
--
--   The application only calls this RPC server-side via createAdminClient()
--   (service_role) from trackOrderAction. Anonymous clients must never be
--   able to call it directly, as it returns order PII (name, address, items,
--   totals) for any phone + order_number/tracking_token combination.
--
--   Since 20261122_sais_store_production.sql is already applied, this
--   corrective migration revokes anon (and authenticated) execute, leaving
--   only service_role.
--
-- No existing data modified.
-- ========================================================================

revoke execute on function public.get_order_for_tracking(text, text) from public, anon, authenticated;
grant execute on function public.get_order_for_tracking(text, text) to service_role;

-- ========================================================================
-- END
-- ========================================================================

-- END: 20261124_06_revoke_anon_tracking_rpc.sql

-- ========================================================================
-- MIGRATION 07: RLS Customer Order Isolation
-- ========================================================================
-- (Full content of 20261124_07_rls_customer_order_isolation.sql)
-- Customer RLS policies (auth_user_id only), table grants

-- BEGIN: 20261124_07_rls_customer_order_isolation.sql
-- ========================================================================
-- SAIS Store — RLS Customer Order Isolation
-- Migration: 20261124_07_rls_customer_order_isolation.sql
-- Description:
--   Adds least-privilege RLS policies so:
--
--   - Customers can READ their own orders (matched by the verified
--     auth_user_id only — never by phone).
--   - Customers can READ their own order_items (via their orders).
--   - Customers CANNOT read other customers' orders.
--   - Anonymous users have NO direct access to orders/order_items (they go
--     through the service-role tracking RPC).
--   - A customer cannot promote themselves to admin via the profiles table.
--
-- Existing admin policies are preserved (re-created idempotently).
-- No existing data modified.
-- ========================================================================

-- ------------------------------------------------------------------------
-- ORDERS — customer can read only their own orders (auth_user_id only)
-- Phone-based matching is intentionally EXCLUDED: shared, changed, or
-- reused phone numbers would let one customer read another customer's
-- order. Guest orders without auth_user_id are accessed via the
-- rate-limited get_order_for_tracking RPC (phone + tracking_token).
-- ------------------------------------------------------------------------
drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders
  for select to authenticated
  using (auth_user_id = auth.uid());

-- Re-create admin policy (idempotent)
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------
-- ORDER ITEMS — customer can read items of their own orders only
-- ------------------------------------------------------------------------
drop policy if exists "Customers read own order items" on public.order_items;
create policy "Customers read own order items" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.auth_user_id = auth.uid()
    )
  );

-- Re-create admin policy
drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items" on public.order_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------
-- ORDER STATUS HISTORY — customer can read history of their own orders only
-- ------------------------------------------------------------------------
drop policy if exists "Customers read own order status history" on public.order_status_history;
create policy "Customers read own order status history" on public.order_status_history
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.auth_user_id = auth.uid()
    )
  );

drop policy if exists "Admins manage order status history" on public.order_status_history;
create policy "Admins manage order status history" on public.order_status_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------
-- PROFILES — prevent self-promotion to admin
-- ------------------------------------------------------------------------
-- The update policy currently allows self-update but blocks role='admin'
-- unless is_admin(). Keep it but make the check explicit and strict.
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (role <> 'admin' or public.is_admin())
  );

-- Re-create admin profile policy
drop policy if exists "Admin manage all profiles" on public.profiles;
create policy "Admin manage all profiles" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------
-- GRANTS — customers can SELECT orders/order_items/status_history
-- (RLS policies enforce row-level isolation). Anonymous has no direct table
-- access at all; guest tracking goes through service-role RPCs.
-- Writes are revoked too: RLS has no customer write policy, and the only
-- legitimate writers are the SECURITY DEFINER RPCs and the service role.
-- ------------------------------------------------------------------------
revoke all on public.orders from anon;
revoke all on public.order_items from anon;
revoke all on public.order_status_history from anon;

revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
revoke insert, update, delete on public.order_status_history from authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.order_status_history to authenticated;

-- ------------------------------------------------------------------------
-- PROFILES — customers keep self-service read/update, but cannot delete
-- their profile row directly (auth cascade handles account deletion).
-- ------------------------------------------------------------------------
revoke delete on public.profiles from anon, authenticated;

-- ========================================================================
-- END
-- ========================================================================

-- END: 20261124_07_rls_customer_order_isolation.sql

-- ========================================================================
-- MIGRATION 08: SECURITY DEFINER Hardening
-- ========================================================================
-- (Full content of 20261124_08_security_definer_hardening.sql)
-- is_admin/get_order_for_tracking search_path, CREATE revocation on public

-- BEGIN: 20261124_08_security_definer_hardening.sql
-- ========================================================================
-- SAIS Store — SECURITY DEFINER Hardening + Public Schema CREATE Revocation
-- Migration: 20261124_08_security_definer_hardening.sql
-- Description:
--   1. Hardens search_path on SECURITY DEFINER functions that are still
--      using the old `public`-only value (is_admin, get_order_for_tracking).
--   2. Revokes CREATE on schema public from PUBLIC, anon, authenticated
--      to prevent untrusted users from creating shadow objects that could
--      be resolved by SECURITY DEFINER functions.
--   3. Documents the security rationale for each exception.
--
-- Rationale for search_path = pg_catalog, public:
--   - pg_catalog is listed FIRST so built-in functions, types, and
--     operators always resolve from the trusted system catalog, preventing
--     shadowing attacks via objects created in the public schema.
--   - public is retained SECOND because extensions (pgcrypto) and our
--     own helper functions live there and are referenced by qualified
--     name (public.xxx). All table references are also fully qualified
--     with the public. prefix.
--   - auth.uid() / auth.jwt() are fully qualified to the auth schema
--     and do not depend on search_path.
--
-- Rationale for CREATE revocation:
--   - In Supabase, the public schema grants CREATE to PUBLIC by default,
--     allowing any authenticated or anonymous user to create objects.
--   - Even with pg_catalog first in search_path, unqualified references
--     to public-schema objects could theoretically be shadowed.
--   - Revoking CREATE prevents untrusted users from introducing shadow
--     objects. service_role retains CREATE for migrations and admin ops.
--
-- No existing data modified. No tables dropped or altered.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Harden is_admin() — replace with pg_catalog, public search_path
-- ------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, public
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

-- ------------------------------------------------------------------------
-- 2. Harden get_order_for_tracking() — replace with pg_catalog, public search_path
-- ------------------------------------------------------------------------
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
set search_path = pg_catalog, public
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

-- ------------------------------------------------------------------------
-- 3. Revoke CREATE on public schema from untrusted roles
-- ------------------------------------------------------------------------
revoke create on schema public from public;
revoke create on schema public from anon;
revoke create on schema public from authenticated;

-- service_role retains CREATE for migrations and admin operations
grant create on schema public to service_role;

-- ------------------------------------------------------------------------
-- 3b. Revoke direct table access on clients and coupons from anon
--      (RLS protects rows, but table-level revocation is defense-in-depth)
-- ------------------------------------------------------------------------
revoke all on public.clients from anon;
revoke all on public.coupons from anon;

-- ------------------------------------------------------------------------
-- 4. Re-grant EXECUTE (is_admin needs authenticated; get_order_for_tracking is service_role only)
-- ------------------------------------------------------------------------
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.get_order_for_tracking(text, text) from public, anon, authenticated;
grant execute on function public.get_order_for_tracking(text, text) to service_role;

-- ------------------------------------------------------------------------
-- END
-- ========================================================================

-- END: 20261124_08_security_definer_hardening.sql

-- ========================================================================
-- POST-MIGRATION VERIFICATION
-- ========================================================================

DO $$
BEGIN
    -- Verify all 5 new tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_ledger') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: inventory_ledger table missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupon_redemptions') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: coupon_redemptions table missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_cancellations') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: order_cancellations table missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_returns') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: order_returns table missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limits') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: rate_limits table missing';
    END IF;

    -- Verify auth_user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'auth_user_id') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: orders.auth_user_id column missing';
    END IF;

    -- Verify coupon_code column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_code') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: orders.coupon_code column missing';
    END IF;

    -- Verify key RPCs exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: cancel_order_rpc missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'return_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: return_order_rpc missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: check_rate_limit missing';
    END IF;

    -- Verify search_path hardening
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: is_admin search_path not hardened';
    END IF;

    RAISE NOTICE 'ALL POST-MIGRATION VERIFICATION CHECKS PASSED';
END;
$$;

-- ========================================================================
-- END OF REMEDIATION SCRIPT
-- ========================================================================
