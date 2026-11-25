with open('supabase/migrations/20261124_04_place_order_rpc_integrity.sql', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  -- ====================================================================
  -- 13. COUPON CONSUMPTION (atomic, after the order exists)
  -- ====================================================================
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
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
  end if;"""

new = """  -- ====================================================================
  -- 13. COUPON CONSUMPTION (atomic, after the order exists)
  --     Locks the coupon row and re-checks per-user limits to prevent
  --     concurrent orders from exceeding per_user_limit.
  -- ====================================================================
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    -- Lock the coupon row to serialize concurrent consumption attempts.
    -- Re-validate per-user limit under the lock.
    DECLARE
      v_coupon_id uuid;
      v_per_user_limit integer;
      v_existing_redemptions integer := 0;
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
  end if;"""

assert old in content, "coupon consumption pattern not found"
content = content.replace(old, new)

with open('supabase/migrations/20261124_04_place_order_rpc_integrity.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
