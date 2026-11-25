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
