with open('supabase/migrations/20261124_04_place_order_rpc_integrity.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add v_coupon_id, v_per_user_limit, v_existing_redemptions to DECLARE section
old_declare = "  v_ledger_key text;"
new_declare = "  v_ledger_key text;\n  v_coupon_id uuid;\n  v_per_user_limit integer;\n  v_existing_redemptions integer := 0;"
assert old_declare in content, "declare pattern not found"
content = content.replace(old_declare, new_declare, 1)

# Fix 2: Replace the DECLARE block with a plain BEGIN block
old_block = """    -- Lock the coupon row to serialize concurrent consumption attempts.
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
    END;"""

new_block = """    -- Lock the coupon row to serialize concurrent consumption attempts.
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
    END;"""

assert old_block in content, "block pattern not found"
content = content.replace(old_block, new_block)

with open('supabase/migrations/20261124_04_place_order_rpc_integrity.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
