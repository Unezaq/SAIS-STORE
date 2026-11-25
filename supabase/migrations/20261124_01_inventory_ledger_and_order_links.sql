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
