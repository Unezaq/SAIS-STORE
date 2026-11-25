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
