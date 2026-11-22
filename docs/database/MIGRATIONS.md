# SAIS STORE — Database Migrations Guide

**Target Environment:** New Supabase Project (PostgreSQL 15+)  
**Canonical Migration:** `supabase/migrations/20261122_sais_store_production.sql`  
**Seed File:** `supabase/seed.sql`

---

## 1. Migration Strategy

The previous database accumulated experimental iterations (custom customer auth, dropped tables, fragmented RLS rules). For the new Supabase project, we establish a **single, idempotent, production-grade consolidated migration**.

### Principles of the Canonical Migration
1. **Idempotence:** Safe to run on a brand-new Supabase database or re-run on an existing test database (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS + CREATE POLICY`).
2. **Deterministic Constraint Enforcement:** Check constraints, foreign keys with explicit cascade rules, and unique indexes are established before policies or triggers are wired.
3. **Pessimistic Concurrency:** Stock decrementing and coupon counting are embedded inside `place_order_rpc` with `SELECT ... FOR UPDATE` row locks, ensuring zero race conditions.
4. **Principle of Least Privilege:** Default permissions are revoked from `public` and `anon`; rights are granted explicitly.

---

## 2. Legacy Migrations Archive

Historical migrations have been preserved in `supabase/archive/legacy_migrations/` for auditability:
- `20261118_sais_store_schema.sql` (Initial experimental multi-table schema)
- `20261118_auth_trigger.sql` (Initial user profile trigger)
- `20261119_cleanup_cod_system.sql` (COD cleanup, custom auth dropped)
- `20261119_guest_first_rls.sql` (Initial guest RLS overhaul)
- `20261121_p0_hardening.sql` (P0 hardening: locking, unique phone, privilege revocation)

These are kept outside the active deployment pipeline.

---

## 3. How to Apply to the New Supabase Project

### Method A: Supabase Dashboard (Recommended)
1. Open your new Supabase Project Dashboard.
2. Navigate to **SQL Editor**.
3. Create a **New query**.
4. Open [`supabase/migrations/20261122_sais_store_production.sql`](file:///f:/sais%20-%20store/supabase/migrations/20261122_sais_store_production.sql), copy its entire contents, and paste into the editor.
5. Click **Run**. Verify: `Success. No rows returned`.
6. Open [`supabase/seed.sql`](file:///f:/sais%20-%20store/supabase/seed.sql), copy its contents, paste into a new query, and click **Run**.
7. In your terminal, run the product catalog seed:
   ```bash
   pnpm db:seed-products -- --confirm
   ```

### Method B: Supabase CLI
```bash
supabase db push
supabase db seed
pnpm db:seed-products -- --confirm
```

---

## 4. Verification Check
After applying the migration, run:
```bash
node scripts/db-verify.mjs
```
The script will verify:
- All 9 production tables exist.
- RLS is enabled on 100% of tables.
- Anon key is denied direct `INSERT` and `SELECT` on orders and clients.
- `place_order_rpc` is executable only by the server (`service_role`).
