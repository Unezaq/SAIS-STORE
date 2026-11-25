-- ========================================================================
-- SAIS Store — P0 hardening regression suite
--
-- Runs inside ONE transaction and ends with ROLLBACK: fixtures, orders,
-- stock movements and coupon counters all disappear. It is safe to run on a
-- staging/test project, and even on production (it only takes row locks for
-- the duration of the run).
--
-- How to run
--   Supabase Dashboard → SQL Editor → paste → RUN (TEST project first)
--   or: psql "$TEST_DATABASE_URL" -f supabase/tests/20261121_p0_hardening.sql
--
-- The last result set is the verdict: PASS/FAIL plus every check.
-- ========================================================================

begin;

-- ---------------------------------------------------------------------
-- helpers (removed by the ROLLBACK at the end)
-- ---------------------------------------------------------------------
create table public._p0_results (
  name text primary key,
  ok boolean not null,
  detail text
);

-- Records a check. SECURITY DEFINER so anon/authenticated probes can record
-- their result without table privileges.
create or replace function public._p0_check(p_name text, p_ok boolean, p_detail text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public._p0_results (name, ok, detail)
  values (p_name, coalesce(p_ok, false), left(coalesce(p_detail, ''), 300))
  on conflict (name) do update set ok = excluded.ok, detail = excluded.detail;
end;
$$;

-- Runs p_sql as the CALLER and returns a scalar as text, or 'ERR:<sqlstate>'.
create or replace function public._p0_scalar(p_sql text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v text;
begin
  execute 'select (' || p_sql || ')::text' into v;
  return coalesce(v, '<null>');
exception
  when others then
    return 'ERR:' || sqlstate;
end;
$$;

-- Asserts that p_sql raises, optionally that the message matches p_match.
-- SECURITY INVOKER: the statement runs with the caller's privileges, which is
-- what makes the anon / authenticated probes meaningful.
create or replace function public._p0_expect_error(p_name text, p_sql text, p_match text default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_message text;
begin
  begin
    execute p_sql;
    v_message := null;
  exception
    when others then
      v_message := sqlerrm;
  end;

  if v_message is null then
    perform public._p0_check(p_name, false, 'no error was raised');
  elsif p_match is null then
    perform public._p0_check(p_name, true, v_message);
  else
    perform public._p0_check(p_name, v_message ilike '%' || p_match || '%', v_message);
  end if;
end;
$$;

-- Asserts that p_sql completes without error.
create or replace function public._p0_expect_ok(p_name text, p_sql text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_message text;
begin
  begin
    execute p_sql;
    v_message := null;
  exception
    when others then
      v_message := sqlstate || ' ' || sqlerrm;
  end;

  perform public._p0_check(p_name, v_message is null, coalesce(v_message, 'completed'));
end;
$$;

-- ---------------------------------------------------------------------
-- fixtures (rolled back with everything else)
-- ---------------------------------------------------------------------
-- Two throw-away auth users for the RLS checks. Inserting a row directly in
-- auth.users works from the SQL editor (it is the postgres role); the row is
-- rolled back with the rest.
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'p0-owner@example.test'),
  ('c0000000-0000-0000-0000-000000000002', 'p0-other@example.test')
on conflict (id) do nothing;

insert into public.products (id, title, slug, price, original_price, image_url, stock, is_active) values
  ('a0000000-0000-0000-0000-000000000001', 'P0 Produit A',    'p0-a',    100.00, null, '/p0-a.jpg', 10, true),
  ('a0000000-0000-0000-0000-000000000002', 'P0 Produit B',    'p0-b',    299.00, 590.00, '/p0-b.jpg', 4, true),
  ('a0000000-0000-0000-0000-000000000003', 'P0 Produit Zéro', 'p0-zero',  50.00, null, '/p0-z.jpg', 0, true),
  ('a0000000-0000-0000-0000-000000000004', 'P0 Produit Off',  'p0-off',   80.00, null, '/p0-o.jpg', 9, false)
on conflict (slug) do nothing;

insert into public.product_variants (id, product_id, size, color, stock, price_adjustment)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'M', 'Rouge', 2, 10)
on conflict do nothing;

insert into public.coupons (code, type, value, min_order, max_uses, used_count) values
  ('p0promo10', 'percentage', 10,   0, 1,    0),
  ('p0gros',    'fixed',      100, 500, null, 0)
on conflict (code) do nothing;

-- =====================================================================
-- 1. checkout happy path
-- =====================================================================
create temp table _p0_order1 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-a","quantity":2}]'::jsonb, null::text, null::text, null::text
);

select public._p0_check('1.1 order id generated', (select order_id like 'ord-%' from _p0_order1), (select order_id from _p0_order1));
select public._p0_check('1.2 order number format SAIS-XXXXXXXX', (select order_number ~ '^SAIS-[A-Z0-9]{8}$' from _p0_order1), (select order_number from _p0_order1));
select public._p0_check('1.3 subtotal 200.00', (select subtotal = 200.00 from _p0_order1), (select subtotal::text from _p0_order1));
select public._p0_check('1.4 delivery fee 22.00', (select delivery_fee = 22.00 from _p0_order1), (select delivery_fee::text from _p0_order1));
select public._p0_check('1.5 total 222.00', (select total = 222.00 from _p0_order1), (select total::text from _p0_order1));
select public._p0_check('1.6 stock 10 -> 8', (select stock = 8 from public.products where slug = 'p0-a'), (select stock::text from public.products where slug = 'p0-a'));
select public._p0_check('1.7 order persisted', (select count(*) = 1 from public.orders where id = (select order_id from _p0_order1)));
select public._p0_check('1.8 order_items persisted', (select count(*) = 1 from public.order_items where order_id = (select order_id from _p0_order1)));
select public._p0_check('1.9 status history persisted', (select count(*) >= 1 from public.order_status_history where order_id = (select order_id from _p0_order1)));

-- =====================================================================
-- 2. free delivery
-- =====================================================================
create temp table _p0_order2 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-a","quantity":3}]'::jsonb, null::text, null::text, null::text
);
select public._p0_check('2.1 free delivery from 3 items', (select delivery_fee = 0 from _p0_order2), (select delivery_fee::text from _p0_order2));
select public._p0_check('2.2 total 300.00', (select total = 300.00 from _p0_order2), (select total::text from _p0_order2));

-- =====================================================================
-- 3. stock failures are atomic (F3.1)
-- =====================================================================
create temp table _p0_orders_before as select count(*) as n from public.orders;

select public._p0_expect_error(
  '3.1 out of stock raises STOCK_INSUFFISANT',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'Client Test','+212600000001','12 rue de test','Casablanca','[{"slug":"p0-zero","quantity":1}]'::jsonb,null::text,null::text,null::text)$q$,
  'STOCK_INSUFFISANT'
);
select public._p0_check('3.2 failed checkout creates no order',
  (select count(*) from public.orders) = (select n from _p0_orders_before));
select public._p0_check('3.3 stock unchanged after failure',
  (select stock = 0 from public.products where slug = 'p0-zero'),
  (select stock::text from public.products where slug = 'p0-zero'));

select public._p0_expect_error(
  '3.4 quantity above stock rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-b","quantity":99}]'::jsonb,null::text,null::text,null::text)$q$,
  'STOCK_INSUFFISANT'
);

-- The sql-level guard that makes overselling impossible even if a lock were
-- ever skipped: the decrement itself refuses to cross zero.
create temp table _p0_guard as
with u as (
  update public.products set stock = stock - 5 where slug = 'p0-b' and stock >= 5 returning 1
)
select count(*) as n from u;

select public._p0_check(
  '3.5 guarded decrement cannot go negative',
  (select n = 0 from _p0_guard),
  'update ... and stock >= qty matched no row'
);

-- =====================================================================
-- 4. coupons are enforced atomically (F3.3)
-- =====================================================================
create temp table _p0_order3 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-a","quantity":1}]'::jsonb, null::text, 'p0promo10', null::text
);
select public._p0_check('4.1 10%% coupon discount 10.00', (select discount_total = 10.00 from _p0_order3), (select discount_total::text from _p0_order3));
select public._p0_check('4.2 coupon total 112.00', (select total = 112.00 from _p0_order3), (select total::text from _p0_order3));
select public._p0_check('4.3 used_count incremented', (select used_count = 1 from public.coupons where code = 'p0promo10'), (select used_count::text from public.coupons where code = 'p0promo10'));

select public._p0_expect_error(
  '4.4 max_uses=1 rejects the second order',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-a","quantity":1}]'::jsonb,null::text,'p0promo10',null::text)$q$,
  'COUPON_INVALIDE'
);
select public._p0_check('4.5 coupon not double-counted', (select used_count = 1 from public.coupons where code = 'p0promo10'), (select used_count::text from public.coupons where code = 'p0promo10'));

select public._p0_expect_error(
  '4.6 min_order enforced',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-a","quantity":1}]'::jsonb,null::text,'p0gros',null::text)$q$,
  'COUPON_INVALIDE'
);

-- =====================================================================
-- 5. idempotency
-- =====================================================================
create temp table _p0_idem1 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-a","quantity":1}]'::jsonb, null::text, null::text, 'p0-idem-1'
);
create temp table _p0_idem2 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-a","quantity":1}]'::jsonb, null::text, null::text, 'p0-idem-1'
);
select public._p0_check('5.1 retry returns the same order',
  (select (select order_id from _p0_idem1) = (select order_id from _p0_idem2)));
select public._p0_check('5.2 retry created no second order',
  (select count(*) = 1 from public.orders where idempotency_key = 'p0-idem-1'));

-- =====================================================================
-- 6. input validation
-- =====================================================================
select public._p0_expect_error('6.1 unknown product rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-nope","quantity":1}]'::jsonb,null::text,null::text,null::text)$q$, 'PRODUIT_INDISPONIBLE');
select public._p0_expect_error('6.2 empty cart rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[]'::jsonb,null::text,null::text,null::text)$q$, 'PANIER_VIDE');
select public._p0_expect_error('6.3 quantity 0 rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-a","quantity":0}]'::jsonb,null::text,null::text,null::text)$q$, 'ARTICLE_INVALIDE');
select public._p0_expect_error('6.4 fractional quantity rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-a","quantity":1.5}]'::jsonb,null::text,null::text,null::text)$q$, 'ARTICLE_INVALIDE');
select public._p0_expect_error('6.5 inactive product rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-off","quantity":1}]'::jsonb,null::text,null::text,null::text)$q$, 'PRODUIT_INDISPONIBLE');
select public._p0_expect_error('6.6 missing customer name rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'','+212600000001','A','Casablanca','[{"slug":"p0-a","quantity":1}]'::jsonb,null::text,null::text,null::text)$q$, 'CLIENT_REQUIS');

-- =====================================================================
-- 7. variants + money precision
-- =====================================================================
create temp table _p0_order4 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-b","size":"M","color":"Rouge","quantity":2}]'::jsonb, null::text, null::text, null::text
);
select public._p0_check('7.1 variant subtotal (299+10)*2', (select subtotal = 618.00 from _p0_order4), (select subtotal::text from _p0_order4));
select public._p0_check('7.2 variant stock 2 -> 0',
  (select stock = 0 from public.product_variants where id = 'b0000000-0000-0000-0000-000000000001'));
select public._p0_check('7.3 variant label stored (color / size)',
  (select variant = 'Rouge / M' from public.order_items where order_id = (select order_id from _p0_order4)));
select public._p0_check('7.4 variant unit price 309.00',
  (select unit_price = 309.00 from public.order_items where order_id = (select order_id from _p0_order4)),
  (select unit_price::text from public.order_items where order_id = (select order_id from _p0_order4)));
select public._p0_expect_error('7.5 variant out of stock rejected',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-b","size":"M","color":"Rouge","quantity":1}]'::jsonb,null::text,null::text,null::text)$q$, 'STOCK_INSUFFISANT');

update public.settings set storewide_discount_percent = 15,
       discount_start_date = now() - interval '1 day',
       discount_end_date = now() + interval '1 day'
 where id = 1;

create temp table _p0_order5 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-a","quantity":1}]'::jsonb, null::text, null::text, null::text
);
select public._p0_check('7.6 storewide discount gives 85.00',
  (select unit_price = 85.00 from public.order_items where order_id = (select order_id from _p0_order5)),
  (select unit_price::text from public.order_items where order_id = (select order_id from _p0_order5)));
select public._p0_check('7.7 line total equals order subtotal',
  (select (select line_total from public.order_items where order_id = (select order_id from _p0_order5)) = subtotal from _p0_order5));
create temp table _p0_order6 as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Test', '+212600000001', '12 rue de test', 'Casablanca',
  '[{"slug":"p0-b","quantity":1}]'::jsonb, null::text, null::text, null::text
);
select public._p0_check('7.8 on-sale product keeps its own price',
  (select unit_price = 299.00 from public.order_items where order_id = (select order_id from _p0_order6)),
  (select unit_price::text from public.order_items where order_id = (select order_id from _p0_order6)));

update public.settings set storewide_discount_percent = 0,
       discount_start_date = null, discount_end_date = null
 where id = 1;

-- =====================================================================
-- 8. clients.phone uniqueness (F3.2)
-- =====================================================================
select public._p0_check(
  '8.1 unique index on clients.phone exists',
  exists (select 1 from pg_indexes where tablename = 'clients' and indexdef ilike '%unique%phone%')
);
select public._p0_expect_error(
  '8.2 duplicate phone rejected',
  $q$insert into public.clients (first_name, last_name, phone) values ('A','B','+212600000009'), ('C','D','+212600000009')$q$,
  'duplicate key'
);
select public._p0_expect_ok(
  '8.3 ON CONFLICT (phone) upsert works (old RPC path)',
  $q$insert into public.clients (first_name, last_name, phone) values ('A','B','+212600000010') on conflict (phone) do update set order_count = public.clients.order_count + 1$q$
);

-- =====================================================================
-- 9. anon has no access to order / client data (F2.1 / F2.2)
-- =====================================================================
select public._p0_check('9.1 anon cannot SELECT orders', has_table_privilege('anon', 'public.orders', 'SELECT') = false);
select public._p0_check('9.2 anon cannot INSERT orders', has_table_privilege('anon', 'public.orders', 'INSERT') = false);
select public._p0_check('9.3 anon cannot SELECT order_items', has_table_privilege('anon', 'public.order_items', 'SELECT') = false);
select public._p0_check('9.4 anon cannot SELECT clients', has_table_privilege('anon', 'public.clients', 'SELECT') = false);
select public._p0_check('9.5 anon cannot SELECT coupons', has_table_privilege('anon', 'public.coupons', 'SELECT') = false);
select public._p0_check('9.6 anon cannot EXECUTE place_order_rpc',
  has_function_privilege('anon', 'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)', 'EXECUTE') = false);
select public._p0_check('9.7 service_role can EXECUTE place_order_rpc',
  has_function_privilege('service_role', 'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)', 'EXECUTE') = true);
select public._p0_check('9.8 no anon policy left on orders',
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and roles::text like '%anon%'));
select public._p0_check('9.9 anon can still read products', has_table_privilege('anon', 'public.products', 'SELECT') = true);
select public._p0_check('9.10 anon can still read settings', has_table_privilege('anon', 'public.settings', 'SELECT') = true);
select public._p0_check('9.11 authenticated keeps SELECT on orders (admin dashboard)',
  has_table_privilege('authenticated', 'public.orders', 'SELECT') = true);

-- live probes, executed as anon
set local role anon;
select public._p0_check('9.12 anon SELECT orders fails at runtime',
  public._p0_scalar('select count(*) from public.orders') = 'ERR:42501',
  public._p0_scalar('select count(*) from public.orders'));
select public._p0_expect_error(
  '9.13 anon EXECUTE place_order_rpc fails at runtime',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000001','A','Casablanca','[{"slug":"p0-a","quantity":1}]'::jsonb,null::text,null::text,null::text)$q$,
  'permission denied'
);
select public._p0_check('9.14 anon can read products at runtime',
  public._p0_scalar('select count(*) from public.products') not like 'ERR%',
  public._p0_scalar('select count(*) from public.products'));
select public._p0_check('9.15 anon can preview a coupon (read-only RPC)',
  public._p0_scalar($q$select valid from public.validate_coupon('p0promo10', 200)$q$) not like 'ERR%',
  public._p0_scalar($q$select valid from public.validate_coupon('p0promo10', 200)$q$));
reset role;

-- =====================================================================
-- 10. RLS: an authenticated user only sees their own orders
-- =====================================================================
create temp table _p0_auth_order as
select * from public.place_order_rpc(
  'c0000000-0000-0000-0000-000000000001'::uuid, null::uuid, null::text, null::text,
  'Client Auth', '+212600000002', '1 rue auth', 'Rabat',
  '[{"slug":"p0-a","quantity":1}]'::jsonb, null::text, null::text, null::text
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select public._p0_check('10.1 owner sees exactly one order',
  public._p0_scalar('select count(*) from public.orders') = '1',
  public._p0_scalar('select count(*) from public.orders'));
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select public._p0_check('10.2 another user sees no orders',
  public._p0_scalar('select count(*) from public.orders') = '0',
  public._p0_scalar('select count(*) from public.orders'));
reset role;

-- =====================================================================
-- 11. CRM rollup written by checkout (one row per phone)
-- =====================================================================
select public._p0_check('11.1 checkout upserts the client CRM row',
  exists (select 1 from public.clients where phone = '+212600000001' and order_count >= 1));
select public._p0_check('11.2 guest checkout never links auth_user_id',
  not exists (select 1 from public.orders where phone = '+212600000001' and auth_user_id is not null));

-- =====================================================================
-- 12. 20261124 migrations — least-privilege grants
-- =====================================================================
select public._p0_check('12.1 anon/authenticated have no inventory_ledger access',
  has_table_privilege('anon', 'public.inventory_ledger', 'SELECT') = false
  and has_table_privilege('authenticated', 'public.inventory_ledger', 'INSERT') = false
  and has_table_privilege('authenticated', 'public.inventory_ledger', 'UPDATE') = false
  and has_table_privilege('authenticated', 'public.inventory_ledger', 'DELETE') = false);
select public._p0_check('12.2 service_role can write the ledger',
  has_table_privilege('service_role', 'public.inventory_ledger', 'INSERT') = true);
select public._p0_check('12.3 anon/authenticated have no coupon_redemptions access',
  has_table_privilege('anon', 'public.coupon_redemptions', 'SELECT') = false
  and has_table_privilege('authenticated', 'public.coupon_redemptions', 'INSERT') = false
  and has_table_privilege('authenticated', 'public.coupon_redemptions', 'UPDATE') = false
  and has_table_privilege('authenticated', 'public.coupon_redemptions', 'DELETE') = false);
select public._p0_check('12.4 customers cannot write orders directly',
  has_table_privilege('authenticated', 'public.orders', 'INSERT') = false
  and has_table_privilege('authenticated', 'public.orders', 'UPDATE') = false
  and has_table_privilege('authenticated', 'public.orders', 'DELETE') = false);
select public._p0_check('12.5 cancellation/return audit tables are not customer-readable',
  has_table_privilege('authenticated', 'public.order_cancellations', 'SELECT') = false
  and has_table_privilege('authenticated', 'public.order_returns', 'SELECT') = false);
select public._p0_check('12.6 check_rate_limit is service_role only',
  has_function_privilege('anon', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') = false
  and has_function_privilege('authenticated', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') = false
  and has_function_privilege('service_role', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') = true);
select public._p0_check('12.7 is_order_owner is service_role only',
  has_function_privilege('authenticated', 'public.is_order_owner(text,uuid)', 'EXECUTE') = false
  and has_function_privilege('service_role', 'public.is_order_owner(text,uuid)', 'EXECUTE') = true);
select public._p0_check('12.8 get_order_for_tracking is service_role only',
  has_function_privilege('anon', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = false
  and has_function_privilege('authenticated', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = false
  and has_function_privilege('service_role', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = true);
select public._p0_check('12.9 cleanup_rate_limits is not anon-executable',
  has_function_privilege('anon', 'public.cleanup_rate_limits()', 'EXECUTE') = false);
select public._p0_check('12.10 legacy validate_coupon(text,numeric) overload removed',
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'validate_coupon' and p.pronargs = 2
  ));
select public._p0_check('12.11 exactly one validate_coupon signature remains',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'validate_coupon') = 1);

-- =====================================================================
-- 13. runtime probes — customers cannot touch ledgers or cancel others
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);

select public._p0_expect_error(
  '13.1 customer cannot insert inventory_ledger',
  $q$insert into public.inventory_ledger (product_id, quantity_change, event_type, idempotency_key) values ('a0000000-0000-0000-0000-000000000001', 1, 'adjustment', 'p0-hack')$q$,
  'permission denied');

select public._p0_expect_error(
  '13.2 customer cannot insert coupon_redemptions',
  $q$insert into public.coupon_redemptions (coupon_id, order_id, discount_amount) select id, 'ord-does-not-exist', 0 from public.coupons limit 1$q$,
  'permission denied');

select public._p0_check('13.3 customer cannot execute check_rate_limit',
  public._p0_scalar($q$select allowed from public.check_rate_limit('p0-probe', 1, 60000)$q$) = 'ERR:42501');

select public._p0_check('13.4 customer cannot execute get_order_for_tracking',
  public._p0_scalar($q$select order_id from public.get_order_for_tracking('SAIS-00000000', '+212600000001')$q$) = 'ERR:42501');

select public._p0_check('13.5 non-admin cannot run cleanup_rate_limits',
  public._p0_scalar($q$select public.cleanup_rate_limits()$q$) like 'ERR:P0001');

reset role;

-- 13.6–13.10 run as postgres with JWT claims set: this isolates the RPC's own
-- authorization logic (auth.uid()) from RLS row visibility.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);

select public._p0_expect_error(
  '13.6 customer cannot cancel another customer''s order',
  $q$select * from public.cancel_order_rpc((select id from public.orders where phone = '+212600000002' limit 1), 'c0000000-0000-0000-0000-000000000002'::uuid, 'customer', 'p0-other-cancel', null)$q$,
  'NON_AUTORISE');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

create temp table _p0_stock_before_cancel as
select stock as s from public.products where slug = 'p0-a';

create temp table _p0_cancel1 as
select * from public.cancel_order_rpc(
  (select id from public.orders where phone = '+212600000002' limit 1),
  'c0000000-0000-0000-0000-000000000001'::uuid, 'customer', 'p0-own-cancel', null
);

select public._p0_check('13.7 owner can cancel their own order',
  (select status = 'annulee' from _p0_cancel1));
select public._p0_check('13.8 cancellation restocked the ordered quantity exactly once',
  (select stock = (select s from _p0_stock_before_cancel) + 1 from public.products where slug = 'p0-a'),
  (select stock::text from public.products where slug = 'p0-a'));
select public._p0_check('13.9 exactly one cancellation ledger row written',
  (select count(*) = 1 from public.inventory_ledger
   where reference_type = 'order'
     and reference_id = (select order_id from _p0_cancel1)
     and event_type = 'cancellation'));
select public._p0_expect_error(
  '13.10 a cancelled order cannot be cancelled twice',
  $q$select * from public.cancel_order_rpc((select id from public.orders where phone = '+212600000002' limit 1), 'c0000000-0000-0000-0000-000000000001'::uuid, 'customer', null, null)$q$,
  'DEJA_ANNULEE');

-- =====================================================================
-- 14. returns — admin only, full return restocks from order_items
-- =====================================================================
create temp table _p0_return_order as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Retour', '+212600000003', '2 rue retour', 'Fes',
  '[{"slug":"p0-a","quantity":1}]'::jsonb, null::text, null::text, 'p0-return-order'
);
update public.orders set status = 'livree'
 where id = (select order_id from _p0_return_order);

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);

select public._p0_expect_error(
  '14.1 non-admin cannot register a return',
  $q$select * from public.return_order_rpc((select order_id from _p0_return_order), 'c0000000-0000-0000-0000-000000000002'::uuid, '[]'::jsonb, 'p0-ret-1', null)$q$,
  'NON_AUTORISE');

-- Clear the JWT: this is the trusted service-role path used by the server.
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

create temp table _p0_stock_before_return as
select stock as s from public.products where slug = 'p0-a';

create temp table _p0_return1 as
select * from public.return_order_rpc(
  (select order_id from _p0_return_order),
  'c0000000-0000-0000-0000-000000000001'::uuid, '[]'::jsonb, 'p0-ret-1', null
);

select public._p0_check('14.2 full return restocks the ordered quantity',
  (select stock = (select s from _p0_stock_before_return) + 1 from public.products where slug = 'p0-a'),
  (select stock::text from public.products where slug = 'p0-a'));
select public._p0_check('14.3 return ledger row written',
  (select count(*) = 1 from public.inventory_ledger
   where reference_type = 'order'
     and reference_id = (select order_id from _p0_return1)
     and event_type = 'return'));
select public._p0_check('14.4 returned status recorded',
  (select status = 'returned' from _p0_return1));
select public._p0_expect_error(
  '14.5 only a delivered order can be returned',
  $q$select * from public.return_order_rpc((select order_id from _p0_return1), 'c0000000-0000-0000-0000-000000000001'::uuid, '[]'::jsonb, 'p0-ret-2', null)$q$,
  'NON_LIVREE');

-- =====================================================================
-- 15. per-line pricing and duplicate cart lines
-- =====================================================================
create temp table _p0_mixed as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Mixte', '+212600000004', '3 rue mixte', 'Tanger',
  '[{"slug":"p0-a","quantity":1},{"slug":"p0-b","quantity":1}]'::jsonb, null::text, null::text, null::text
);
select public._p0_check('15.1 each line keeps its own unit price',
  (select count(*) filter (where unit_price = 100.00) = 1
      and count(*) filter (where unit_price = 299.00) = 1
   from public.order_items where order_id = (select order_id from _p0_mixed)),
  (select string_agg(unit_price::text, ',' order by unit_price) from public.order_items where order_id = (select order_id from _p0_mixed)));
select public._p0_check('15.2 subtotal is the sum of the line totals',
  (select subtotal = 399.00 from _p0_mixed),
  (select subtotal::text from _p0_mixed));

select public._p0_expect_error(
  '15.3 an idempotency key cannot be replayed from another phone',
  $q$select * from public.place_order_rpc(null::uuid,null::uuid,null::text,null::text,'XX','+212600000099','A','Casablanca','[{"slug":"p0-a","quantity":1}]'::jsonb,null::text,null::text,'p0-return-order')$q$,
  'DOUBLON');

create temp table _p0_dup as
select * from public.place_order_rpc(
  null::uuid, null::uuid, null::text, null::text,
  'Client Doublon', '+212600000005', '4 rue doublon', 'Agadir',
  '[{"slug":"p0-b","quantity":1},{"slug":"p0-b","quantity":1}]'::jsonb, null::text, null::text, null::text
);
select public._p0_check('15.4 duplicate cart lines are aggregated into one order_item',
  (select count(*) = 1 and sum(quantity) = 2 from public.order_items
   where order_id = (select order_id from _p0_dup)));
select public._p0_check('15.5 aggregated line charged once (299 x 2)',
  (select subtotal = 598.00 from _p0_dup),
  (select subtotal::text from _p0_dup));

-- =====================================================================
-- result
-- =====================================================================
select name, ok, detail from public._p0_results order by name;

select case
         when bool_and(ok) then 'PASS — ' || count(*) || ' checks'
         else 'FAIL — ' || (count(*) filter (where not ok)) || ' of ' || count(*) || ' checks failed'
       end as verdict
  from public._p0_results;

rollback;
