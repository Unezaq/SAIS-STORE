-- ========================================================================
-- SAIS STORE — REMOTE SUPABASE VERIFICATION QUERIES
-- Run these AFTER executing REMEDIATION.sql to verify all changes.
-- All queries are READ-ONLY. No data is modified.
--
-- OUTPUT: Returns one row per check with:
--   check_id, category, check_name, status (PASS/FAIL/WARNING),
--   actual_value, expected_value, details
-- Followed by a summary row with total_checks, passed, failed, warnings.
-- ========================================================================

WITH checks AS (
    -- ========================================================================
    -- 1. TABLE EXISTENCE
    -- ========================================================================
    SELECT '1.1' AS check_id, 'Tables' AS category, 'inventory_ledger exists' AS check_name,
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_ledger') THEN 'PASS' ELSE 'FAIL' END AS status,
           COALESCE((SELECT 'exists' FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_ledger' LIMIT 1), 'missing') AS actual_value,
           'exists' AS expected_value,
           'Required by migrations 01-04' AS details
    UNION ALL
    SELECT '1.2', 'Tables', 'coupon_redemptions exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupon_redemptions') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT 'exists' FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupon_redemptions' LIMIT 1), 'missing'),
           'exists', 'Required by migrations 01, 03, 04'
    UNION ALL
    SELECT '1.3', 'Tables', 'order_cancellations exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_cancellations') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT 'exists' FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_cancellations' LIMIT 1), 'missing'),
           'exists', 'Required by migration 02'
    UNION ALL
    SELECT '1.4', 'Tables', 'order_returns exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_returns') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT 'exists' FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_returns' LIMIT 1), 'missing'),
           'exists', 'Required by migration 02'
    UNION ALL
    SELECT '1.5', 'Tables', 'rate_limits exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limits') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT 'exists' FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limits' LIMIT 1), 'missing'),
           'exists', 'Required by migration 05'

    -- ========================================================================
    -- 2. COLUMN EXISTENCE
    -- ========================================================================
    UNION ALL
    SELECT '2.1', 'Columns', 'orders.auth_user_id exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'auth_user_id') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'auth_user_id' LIMIT 1), 'missing'),
           'uuid', 'Required by migration 01 for customer RLS isolation'
    UNION ALL
    SELECT '2.2', 'Columns', 'orders.coupon_code exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_code') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_code' LIMIT 1), 'missing'),
           'text', 'Required by migration 02 for coupon reversal on cancellation'
    UNION ALL
    SELECT '2.3', 'Columns', 'coupon_redemptions.redeemed_phone exists',
           CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coupon_redemptions' AND column_name = 'redeemed_phone') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coupon_redemptions' AND column_name = 'redeemed_phone' LIMIT 1), 'missing'),
           'text', 'Required by migration 03 for guest coupon tracking'

    -- ========================================================================
    -- 3. RPC FUNCTION EXISTENCE & SECURITY DEFINER
    -- ========================================================================
    UNION ALL
    SELECT '3.1', 'Functions', 'cancel_order_rpc exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'cancel_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Required by migration 02'
    UNION ALL
    SELECT '3.2', 'Functions', 'return_order_rpc exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'return_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'return_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Required by migration 02'
    UNION ALL
    SELECT '3.3', 'Functions', 'is_order_owner exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_order_owner' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'is_order_owner' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Required by migration 02'
    UNION ALL
    SELECT '3.4', 'Functions', 'check_rate_limit exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'check_rate_limit' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Required by migration 05'
    UNION ALL
    SELECT '3.5', 'Functions', 'cleanup_rate_limits exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_rate_limits' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'cleanup_rate_limits' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Required by migration 05'
    UNION ALL
    SELECT '3.6', 'Functions', 'coupon_redemption_count_for_user exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'coupon_redemption_count_for_user' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'coupon_redemption_count_for_user' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Required by migration 01'
    UNION ALL
    SELECT '3.7', 'Functions', 'is_admin exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Base migration'
    UNION ALL
    SELECT '3.8', 'Functions', 'get_order_for_tracking exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_order_for_tracking' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'get_order_for_tracking' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Base migration'
    UNION ALL
    SELECT '3.9', 'Functions', 'place_order_rpc exists & SECURITY DEFINER',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'place_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prosecdef = true) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END FROM pg_proc WHERE proname = 'place_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           'SECURITY DEFINER', 'Base migration (rewritten by migration 04)'

    -- ========================================================================
    -- 4. SEARCH_PATH HARDENING
    -- ========================================================================
    UNION ALL
    SELECT '4.1', 'SearchPath', 'is_admin search_path hardened',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT proconfig::text FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'no config'),
           'search_path=pg_catalog, public', 'Migration 08'
    UNION ALL
    SELECT '4.2', 'SearchPath', 'get_order_for_tracking search_path hardened',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_order_for_tracking' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT proconfig::text FROM pg_proc WHERE proname = 'get_order_for_tracking' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'no config'),
           'search_path=pg_catalog, public', 'Migration 08'
    UNION ALL
    SELECT '4.3', 'SearchPath', 'place_order_rpc search_path hardened',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'place_order_rpc' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT proconfig::text FROM pg_proc WHERE proname = 'place_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'no config'),
           'search_path=pg_catalog, public', 'Migration 04'
    UNION ALL
    SELECT '4.4', 'SearchPath', 'cancel_order_rpc search_path hardened',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_order_rpc' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT proconfig::text FROM pg_proc WHERE proname = 'cancel_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'no config'),
           'search_path=pg_catalog, public', 'Migration 02'
    UNION ALL
    SELECT '4.5', 'SearchPath', 'return_order_rpc search_path hardened',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'return_order_rpc' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT proconfig::text FROM pg_proc WHERE proname = 'return_order_rpc' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'no config'),
           'search_path=pg_catalog, public', 'Migration 02'
    UNION ALL
    SELECT '4.6', 'SearchPath', 'check_rate_limit search_path hardened',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit' AND proconfig::text LIKE '%search_path=pg_catalog%') THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT proconfig::text FROM pg_proc WHERE proname = 'check_rate_limit' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'no config'),
           'search_path=pg_catalog, public', 'Migration 05'

    -- ========================================================================
    -- 5. FUNCTION EXECUTE PRIVILEGES
    -- ========================================================================
    UNION ALL
    SELECT '5.1', 'Privileges', 'anon cannot execute place_order_rpc',
           CASE WHEN has_function_privilege('anon', 'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 04'
    UNION ALL
    SELECT '5.2', 'Privileges', 'anon cannot execute cancel_order_rpc',
           CASE WHEN has_function_privilege('anon', 'public.cancel_order_rpc(text,uuid,text,text,text)', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.cancel_order_rpc(text,uuid,text,text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 02'
    UNION ALL
    SELECT '5.3', 'Privileges', 'anon cannot execute return_order_rpc',
           CASE WHEN has_function_privilege('anon', 'public.return_order_rpc(text,uuid,jsonb,text,text)', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.return_order_rpc(text,uuid,jsonb,text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 02'
    UNION ALL
    SELECT '5.4', 'Privileges', 'anon cannot execute check_rate_limit',
           CASE WHEN has_function_privilege('anon', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 05'
    UNION ALL
    SELECT '5.5', 'Privileges', 'anon cannot execute cleanup_rate_limits',
           CASE WHEN has_function_privilege('anon', 'public.cleanup_rate_limits()', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.cleanup_rate_limits()', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 05'
    UNION ALL
    SELECT '5.6', 'Privileges', 'anon cannot execute get_order_for_tracking',
           CASE WHEN has_function_privilege('anon', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.get_order_for_tracking(text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 06'
    UNION ALL
    SELECT '5.7', 'Privileges', 'anon cannot execute is_order_owner',
           CASE WHEN has_function_privilege('anon', 'public.is_order_owner(text,uuid)', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.is_order_owner(text,uuid)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 02'
    UNION ALL
    SELECT '5.8', 'Privileges', 'service_role can execute place_order_rpc',
           CASE WHEN has_function_privilege('service_role', 'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)', 'EXECUTE') = true THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('service_role', 'public.place_order_rpc(uuid,uuid,text,text,text,text,text,text,jsonb,text,text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'GRANTED', 'Migration 04'
    UNION ALL
    SELECT '5.9', 'Privileges', 'service_role can execute check_rate_limit',
           CASE WHEN has_function_privilege('service_role', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') = true THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('service_role', 'public.check_rate_limit(text,integer,integer)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'GRANTED', 'Migration 05'
    UNION ALL
    SELECT '5.10', 'Privileges', 'service_role can execute get_order_for_tracking',
           CASE WHEN has_function_privilege('service_role', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = true THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('service_role', 'public.get_order_for_tracking(text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'GRANTED', 'Migration 06'

    -- ========================================================================
    -- 6. TABLE PRIVILEGES
    -- ========================================================================
    UNION ALL
    SELECT '6.1', 'TablePrivs', 'anon cannot SELECT inventory_ledger',
           CASE WHEN has_table_privilege('anon', 'public.inventory_ledger', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('anon', 'public.inventory_ledger', 'SELECT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 01'
    UNION ALL
    SELECT '6.2', 'TablePrivs', 'anon cannot SELECT coupon_redemptions',
           CASE WHEN has_table_privilege('anon', 'public.coupon_redemptions', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('anon', 'public.coupon_redemptions', 'SELECT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 01'
    UNION ALL
    SELECT '6.3', 'TablePrivs', 'anon cannot SELECT orders',
           CASE WHEN has_table_privilege('anon', 'public.orders', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('anon', 'public.orders', 'SELECT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 07'
    UNION ALL
    SELECT '6.4', 'TablePrivs', 'anon cannot SELECT clients',
           CASE WHEN has_table_privilege('anon', 'public.clients', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('anon', 'public.clients', 'SELECT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 08'
    UNION ALL
    SELECT '6.5', 'TablePrivs', 'anon cannot SELECT coupons',
           CASE WHEN has_table_privilege('anon', 'public.coupons', 'SELECT') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('anon', 'public.coupons', 'SELECT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 08'
    UNION ALL
    SELECT '6.6', 'TablePrivs', 'authenticated cannot INSERT orders',
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'INSERT') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'INSERT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 07'
    UNION ALL
    SELECT '6.7', 'TablePrivs', 'authenticated cannot UPDATE orders',
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'UPDATE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'UPDATE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 07'
    UNION ALL
    SELECT '6.8', 'TablePrivs', 'authenticated cannot DELETE orders',
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'DELETE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'DELETE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 07'
    UNION ALL
    SELECT '6.9', 'TablePrivs', 'authenticated can SELECT orders',
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'SELECT') = true THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('authenticated', 'public.orders', 'SELECT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'GRANTED', 'Migration 07'
    UNION ALL
    SELECT '6.10', 'TablePrivs', 'service_role can access inventory_ledger',
           CASE WHEN has_table_privilege('service_role', 'public.inventory_ledger', 'INSERT') = true THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_table_privilege('service_role', 'public.inventory_ledger', 'INSERT') THEN 'GRANTED' ELSE 'REVOKED' END,
           'GRANTED', 'Migration 01'

    -- ========================================================================
    -- 7. SCHEMA PRIVILEGES
    -- ========================================================================
    UNION ALL
    SELECT '7.1', 'SchemaPrivs', 'anon cannot CREATE in public',
           CASE WHEN has_schema_privilege('anon', 'public', 'CREATE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_schema_privilege('anon', 'public', 'CREATE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 08'
    UNION ALL
    SELECT '7.2', 'SchemaPrivs', 'authenticated cannot CREATE in public',
           CASE WHEN has_schema_privilege('authenticated', 'public', 'CREATE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_schema_privilege('authenticated', 'public', 'CREATE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 08'
    UNION ALL
    SELECT '7.3', 'SchemaPrivs', 'service_role can CREATE in public',
           CASE WHEN has_schema_privilege('service_role', 'public', 'CREATE') = true THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_schema_privilege('service_role', 'public', 'CREATE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'GRANTED', 'Migration 08'

    -- ========================================================================
    -- 8. RLS ENABLED
    -- ========================================================================
    UNION ALL
    SELECT '8.1', 'RLS', 'RLS enabled on orders',
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.orders'::regclass) THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.orders'::regclass) THEN 'enabled' ELSE 'disabled' END,
           'enabled', 'Base migration'
    UNION ALL
    SELECT '8.2', 'RLS', 'RLS enabled on inventory_ledger',
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.inventory_ledger'::regclass) THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.inventory_ledger'::regclass) THEN 'enabled' ELSE 'disabled' END,
           'enabled', 'Migration 01'
    UNION ALL
    SELECT '8.3', 'RLS', 'RLS enabled on coupon_redemptions',
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.coupon_redemptions'::regclass) THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.coupon_redemptions'::regclass) THEN 'enabled' ELSE 'disabled' END,
           'enabled', 'Migration 01'
    UNION ALL
    SELECT '8.4', 'RLS', 'RLS enabled on rate_limits',
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rate_limits'::regclass) THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rate_limits'::regclass) THEN 'enabled' ELSE 'disabled' END,
           'enabled', 'Migration 05'

    -- ========================================================================
    -- 9. RLS POLICIES
    -- ========================================================================
    UNION ALL
    SELECT '9.1', 'Policies', 'Customers read own orders policy exists',
           CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Customers read own orders') THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Customers read own orders') THEN 'exists' ELSE 'missing' END,
           'exists', 'Migration 07'
    UNION ALL
    SELECT '9.2', 'Policies', 'No anon policies on orders',
           CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND roles::text LIKE '%anon%') THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND roles::text LIKE '%anon%') THEN 'none' ELSE 'found' END,
           'none', 'Migration 07'
    UNION ALL
    SELECT '9.3', 'Policies', 'Admin manage orders policy exists',
           CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Admins manage orders') THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Admins manage orders') THEN 'exists' ELSE 'missing' END,
           'exists', 'Base + Migration 07'

    -- ========================================================================
    -- 10. VALIDATE_COUPON SIGNATURE
    -- ========================================================================
    UNION ALL
    SELECT '10.1', 'Functions', 'validate_coupon has 4 args',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_coupon' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND pronargs = 4) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT pronargs::text FROM pg_proc WHERE proname = 'validate_coupon' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1), 'missing'),
           '4', 'Migration 03'
    UNION ALL
    SELECT '10.2', 'Functions', 'only one validate_coupon exists',
           CASE WHEN (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'validate_coupon') = 1 THEN 'PASS' ELSE 'FAIL' END,
           (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'validate_coupon'),
           '1', 'Migration 03 (drops old 2-arg)'

    -- ========================================================================
    -- 11. DEFAULT PRIVILEGES
    -- ========================================================================
    UNION ALL
    SELECT '11.1', 'DefaultPrivs', 'Default table privileges not overly broad',
           CASE WHEN NOT EXISTS (
               SELECT 1 FROM pg_default_acl
               WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                 AND defaclobjtype = 'r'
                 AND defaclacl::text LIKE '%arwdDxt%'
                 AND defaclacl::text NOT LIKE '%service_role%'
           ) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT string_agg(defaclrole::regrole::text || '=' || defaclacl::text, '; ') FROM pg_default_acl WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND defaclobjtype = 'r'), 'none'),
           'no arwdDxt grants (except service_role)', 'Remediation: revoke broad default table grants'
    UNION ALL
    SELECT '11.2', 'DefaultPrivs', 'Default sequence privileges not overly broad',
           CASE WHEN NOT EXISTS (
               SELECT 1 FROM pg_default_acl
               WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                 AND defaclobjtype = 'S'
                 AND defaclacl::text LIKE '%rwU%'
                 AND defaclacl::text NOT LIKE '%service_role%'
           ) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT string_agg(defaclrole::regrole::text || '=' || defaclacl::text, '; ') FROM pg_default_acl WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND defaclobjtype = 'S'), 'none'),
           'no broad rwU grants (except service_role)', 'Remediation: revoke broad default sequence grants'
    UNION ALL
    SELECT '11.3', 'DefaultPrivs', 'Default function privileges not overly broad',
           CASE WHEN NOT EXISTS (
               SELECT 1 FROM pg_default_acl
               WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                 AND defaclobjtype = 'f'
                 AND defaclacl::text LIKE '%=X/%'
                 AND defaclacl::text NOT LIKE '%service_role%'
           ) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT string_agg(defaclrole::regrole::text || '=' || defaclacl::text, '; ') FROM pg_default_acl WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND defaclobjtype = 'f'), 'none'),
           'no broad X grants (except service_role)', 'Remediation: revoke broad default function grants'
    UNION ALL
    SELECT '11.4', 'DefaultPrivs', 'service_role retains default table access',
           CASE WHEN EXISTS (
               SELECT 1 FROM pg_default_acl
               WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                 AND defaclobjtype = 'r'
                 AND defaclacl::text LIKE '%service_role%'
           ) THEN 'PASS' ELSE 'FAIL' END,
           COALESCE((SELECT string_agg(defaclrole::regrole::text || '=' || defaclacl::text, '; ') FROM pg_default_acl WHERE defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND defaclobjtype = 'r'), 'none'),
           'service_role present', 'Remediation: service_role must retain ALL'
    UNION ALL
    SELECT '11.5', 'DefaultPrivs', 'supabase_admin default privileges status',
           CASE
             WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN 'WARNING'
             WHEN EXISTS (
                 SELECT 1 FROM pg_default_acl
                 WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
                   AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                   AND defaclobjtype = 'f'
                   AND defaclacl::text LIKE '%anon=X%'
             ) THEN 'WARNING'
             WHEN EXISTS (
                 SELECT 1 FROM pg_default_acl
                 WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
                   AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                   AND defaclobjtype = 'f'
                   AND defaclacl::text LIKE '%authenticated=X%'
             ) THEN 'WARNING'
             ELSE 'PASS'
           END AS status,
           COALESCE((SELECT string_agg(defaclrole::regrole::text || ':' || defaclobjtype::text || '=' || defaclacl::text, '; ') FROM pg_default_acl WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin') AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')), 'role not present or no defaults'),
           'no broad anon/authenticated X grants from supabase_admin', 'LIMITATION: supabase_admin defaults may not be modifiable from SQL Editor. If broad grants persist, new objects created by supabase_admin will have default access. Compensating: explicit REVOKE/GRANT in migrations for all objects.'

    -- ========================================================================
    -- 12. TRACKING RPC RESTRICTION
    -- ========================================================================
    UNION ALL
    SELECT '12.1', 'TrackingRPC', 'get_order_for_tracking service_role only',
           CASE WHEN has_function_privilege('service_role', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = true
                AND has_function_privilege('anon', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = false
                AND has_function_privilege('authenticated', 'public.get_order_for_tracking(text,text)', 'EXECUTE') = false
           THEN 'PASS' ELSE 'FAIL' END,
           'anon:' || CASE WHEN has_function_privilege('anon', 'public.get_order_for_tracking(text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END
           || ', auth:' || CASE WHEN has_function_privilege('authenticated', 'public.get_order_for_tracking(text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END
           || ', sr:' || CASE WHEN has_function_privilege('service_role', 'public.get_order_for_tracking(text,text)', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'anon:REVOKED, auth:REVOKED, sr:GRANTED', 'Migration 06'

    -- ========================================================================
    -- 13. RATE LIMIT AUTHORIZATION
    -- ========================================================================
    UNION ALL
    SELECT '13.1', 'RateLimit', 'cleanup_rate_limits not anon-executable',
           CASE WHEN has_function_privilege('anon', 'public.cleanup_rate_limits()', 'EXECUTE') = false THEN 'PASS' ELSE 'FAIL' END,
           CASE WHEN has_function_privilege('anon', 'public.cleanup_rate_limits()', 'EXECUTE') THEN 'GRANTED' ELSE 'REVOKED' END,
           'REVOKED', 'Migration 05'
)

-- Return all check results followed by summary row
SELECT check_id, category, check_name, status, actual_value, expected_value, details
FROM (
    SELECT check_id, category, check_name, status, actual_value, expected_value, details, 0 AS sort_order
    FROM checks

    UNION ALL

    SELECT 'SUMMARY' AS check_id,
           'Summary' AS category,
           'FINAL VERDICT' AS check_name,
           CASE WHEN (SELECT count(*) FROM checks WHERE status = 'FAIL') = 0
            AND (SELECT count(*) FROM checks WHERE status = 'WARNING') = 0
       THEN 'PASS'
       WHEN (SELECT count(*) FROM checks WHERE status = 'FAIL') = 0
            AND (SELECT count(*) FROM checks WHERE status = 'WARNING') > 0
       THEN 'WARNING'
       ELSE 'FAIL'
       END AS status,
           'passed=' || (SELECT count(*) FILTER (WHERE status = 'PASS')::text FROM checks)
               || ', failed=' || (SELECT count(*) FILTER (WHERE status = 'FAIL')::text FROM checks)
               || ', warnings=' || (SELECT count(*) FILTER (WHERE status = 'WARNING')::text FROM checks)
               || ', info=' || (SELECT count(*) FILTER (WHERE status = 'INFO')::text FROM checks) AS actual_value,
           'failed=0, warnings=0' AS expected_value,
           'total_checks=' || (SELECT count(*)::text FROM checks) AS details,
           1 AS sort_order
) AS all_results
ORDER BY sort_order, check_id;
