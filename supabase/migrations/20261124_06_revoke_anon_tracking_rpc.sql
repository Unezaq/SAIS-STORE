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
