-- ========================================================================
-- SAIS Store — Guest-First RLS (idempotent)
-- Run AFTER supabase/migrations/20261118_sais_store_schema.sql
-- ========================================================================

-- --------------------------------------------------------
-- orders: allow anon to INSERT (guest checkout via RPC + direct insert)
-- --------------------------------------------------------
drop policy if exists "Anon can create orders" on public.orders;
create policy "Anon can create orders" on public.orders
  for insert to anon
  with check (true);

drop policy if exists "Anon can read own orders" on public.orders;
create policy "Anon can read own orders" on public.orders
  for select to anon
  using (true);

-- Keep existing authenticated user read policy (for account holders who may return)
-- Users or admins read orders already exists from the base migration.

-- --------------------------------------------------------
-- order_items: allow anon to INSERT (guest order line items)
-- --------------------------------------------------------
drop policy if exists "Anon can create order items" on public.order_items;
create policy "Anon can create order items" on public.order_items
  for insert to anon
  with check (true);

-- --------------------------------------------------------
-- products: public read (already exists in base migration, re-stated for clarity)
-- --------------------------------------------------------
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products
  for select to public using (is_active = true);

-- --------------------------------------------------------
-- settings: public read (already exists in base migration)
-- --------------------------------------------------------
drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings
  for select to public using (true);

-- --------------------------------------------------------
-- coupons: NOT publicly readable (validated via SECURITY DEFINER RPC only)
-- --------------------------------------------------------
drop policy if exists "Coupons are not publicly readable" on public.coupons;
create policy "Coupons are not publicly readable" on public.coupons
  for all to anon using (false);

-- ========================================================================
-- End
-- ========================================================================
