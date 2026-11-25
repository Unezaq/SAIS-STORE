-- ========================================================================
-- SAIS STORE — REMOTE DEFAULT PRIVILEGES REMEDIATION
-- Target Project: dlkrjwsapwsjnqwkzjes
-- PostgreSQL: 14.18 compatible
--
-- PURPOSE:
--   Harden default privileges on the public schema so that future objects
--   created by postgres or supabase_admin do NOT automatically grant broad
--   access (arwdDxtm on tables, rwU on sequences, X on functions) to
--   anon and authenticated roles.
--
-- SAFETY:
--   - No data is modified or deleted.
--   - Only ALTER DEFAULT PRIVILEGES statements (affects future objects).
--   - Existing object grants are NOT changed (handled by migrations).
--   - service_role retains ALL access.
--   - Explicit grants in migrations (01-08) still apply to specific objects.
--
-- EXECUTION: Run in Supabase Dashboard SQL Editor
--   https://supabase.com/dashboard/project/dlkrjwsapwsjnqwkzjes/sql
--
-- LIMITATION:
--   - If the SQL Editor runs as 'postgres', only postgres's defaults are
--     modified. supabase_admin's defaults may require running as that role.
--   - Supabase internal objects created by supabase_admin may still have
--     broad defaults. This is a Supabase platform limitation.
-- ========================================================================

-- ========================================================================
-- 1. REVOKE BROAD DEFAULT PRIVILEGES FOR postgres CREATOR
-- ========================================================================

-- Tables: Revoke ALL from PUBLIC, anon, authenticated on future tables
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

-- Sequences: Revoke ALL from PUBLIC, anon, authenticated on future sequences
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- Functions: Revoke EXECUTE from PUBLIC, anon, authenticated on future functions
-- Note: Individual RPC grants are handled by migrations. Default should be
-- minimal — authenticated can only execute explicitly granted functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ========================================================================
-- 2. GRANT MINIMAL DEFAULT PRIVILEGES FOR postgres CREATOR
-- ========================================================================

-- Tables: Grant SELECT to authenticated (RLS filters rows; base privilege needed)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT ON TABLES TO authenticated;

-- Sequences: Grant USAGE to authenticated (needed for SERIAL columns)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO authenticated;

-- Functions: NO default EXECUTE grant to authenticated.
-- Individual RPC grants are handled by migrations (01-08).
-- This ensures new functions are not callable unless explicitly granted.

-- service_role retains ALL on all object types (bypasses RLS)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO service_role;

-- ========================================================================
-- 3. REVOKE BROAD DEFAULT PRIVILEGES FOR supabase_admin CREATOR
--    (May fail if SQL Editor runs as postgres — see limitation note)
-- ========================================================================

DO $$
BEGIN
    -- Attempt to modify supabase_admin's defaults (may not be permitted)
    BEGIN
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

        -- Grant minimal to authenticated
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            GRANT SELECT ON TABLES TO authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            GRANT USAGE ON SEQUENCES TO authenticated;

        -- service_role retains ALL
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            GRANT ALL ON TABLES TO service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            GRANT ALL ON SEQUENCES TO service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
            GRANT ALL ON FUNCTIONS TO service_role;

        RAISE NOTICE 'supabase_admin default privileges hardened successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not modify supabase_admin defaults (expected if SQL Editor runs as postgres): %', SQLERRM;
    END;
END;
$$;

-- ========================================================================
-- 4. VERIFICATION
-- ========================================================================

-- Check postgres defaults
SELECT 'postgres tables' AS creator_type, defaclacl::text AS acl
FROM pg_default_acl
WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
  AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND defaclobjtype = 'r';

SELECT 'postgres sequences' AS creator_type, defaclacl::text AS acl
FROM pg_default_acl
WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
  AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND defaclobjtype = 'S';

SELECT 'postgres functions' AS creator_type, defaclacl::text AS acl
FROM pg_default_acl
WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
  AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND defaclobjtype = 'f';

-- Check supabase_admin defaults (if exists)
SELECT 'supabase_admin tables' AS creator_type, defaclacl::text AS acl
FROM pg_default_acl
WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
  AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND defaclobjtype = 'r';

SELECT 'supabase_admin sequences' AS creator_type, defaclacl::text AS acl
FROM pg_default_acl
WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
  AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND defaclobjtype = 'S';

SELECT 'supabase_admin functions' AS creator_type, defaclacl::text AS acl
FROM pg_default_acl
WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
  AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND defaclobjtype = 'f';

-- ========================================================================
-- END
-- ========================================================================
