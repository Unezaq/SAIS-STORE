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
