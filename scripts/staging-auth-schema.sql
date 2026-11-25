-- ========================================================================
-- SAIS Store — Staging Auth Schema Simulation
-- Creates the Supabase auth schema objects needed for migration testing.
-- This is NOT production code — it simulates Supabase's auth system for
-- local PostgreSQL testing only.
-- ========================================================================

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table (minimal)
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    app_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create auth.uid() function
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Create auth.jwt() function
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
    );
$$;

-- Create auth.role() function (sometimes used)
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
$$;

-- Create auth.email() function
CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.email', true), '');
$$;

-- Grant usage on auth schema to all roles
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT SELECT ON auth.users TO PUBLIC;

-- Create the handle_new_user trigger function's dependency
-- (the trigger is created in the base migration)
