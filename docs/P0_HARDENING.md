# P0 hardening — checkout, stock, coupons and RLS

Status: **implemented, tested against a local PostgreSQL 18 instance, not yet applied to production.**
Date: 2026-11-21

## What was broken

| Ref | Problem | Where |
| --- | --- | --- |
| F2.1 | `anon` could `SELECT` every order (customer names, phones, addresses) | policy `Anon can read own orders … using (true)` (`20261119_guest_first_rls.sql`) + Supabase's default `GRANT ALL` |
| F2.2 | `anon` could `INSERT` orders and order items directly, bypassing prices, stock and coupons | policies `Anon can create orders` / `Anon can create order items` |
| F3.1 | No row locking between the stock check and the decrement → two concurrent checkouts could oversell | `place_order_rpc` |
| F3.2 | `clients.phone` was only a plain index, while the code used `ON CONFLICT (phone)` → `42P10`, and guest duplicates were possible | `20261119_cleanup_cod_system.sql` |
| F3.3 | `coupons.used_count` was incremented outside any lock, and the COD-era RPC did not increment it at all → `max_uses` unenforced | `place_order_rpc` |
| NEW | `revoke execute … from public` also removed the grant from `service_role`, so the server actions (the only legitimate caller) had no `EXECUTE` on the RPC; `createOrder()` then fell back to a direct insert with client-supplied totals | base migration + `lib/store.ts` |
| NEW | `order_items.unit_price/line_total` were `integer` while `orders.total` was `numeric(10,2)`; a 15 % storewide discount stored `254` on the line and `254.15` on the order | schema |

Live state at audit time: `orders`, `coupons`, `clients` all empty, 16 products
(three at stock 0), settings at defaults. `anon` reached `GET /rest/v1/orders`
with HTTP 200, which is consistent with F2.1.

## What the migration does

`supabase/migrations/20261121_p0_hardening.sql` (idempotent, transactional):

1. **anon loses every privilege** on `orders`, `order_items`,
   `order_status_history`, `clients`, `coupons`, and the three permissive anon
   policies are dropped. `authenticated` keeps `SELECT` because `/admin/orders`
   reads through the SSR client and RLS already limits rows to the owner or
   `is_admin()`. `products` and `settings` stay publicly readable.
2. **`clients.phone` becomes UNIQUE.** Duplicate phones are merged first
   (counters summed, then redundant rows deleted), `updated_at` is added, and
   the old plain index is replaced by `idx_clients_phone_unique`.
3. **`order_items` money columns become `numeric(10,2)`** so lines and totals
   agree to the cent.
4. **`place_order_rpc` is rewritten**:
   - `SELECT … FOR UPDATE` on products, then variants, in slug order (no
     deadlocks), and a guarded `update … where stock >= qty` as a second
     safety net;
   - coupon row locked in the same transaction, `used_count` incremented there
     → `max_uses` is a hard limit;
   - prices, delivery fee and discount recomputed from the database; the client
     only supplies slugs and quantities;
   - idempotency: fast path + `unique_violation` recovery returns the order
     that won a concurrent retry;
   - the whole function is one transaction: any failure leaves no order, no
     stock movement, no coupon increment;
   - it no longer writes `clients` (that double-counted `order_count` together
     with `lib/store.ts`).
5. **Privileges are restated**: `EXECUTE` revoked from `anon`/`authenticated`/
   `public` and granted to `service_role`; stale overloads of
   `place_order_rpc`/`validate_coupon` are removed so PostgREST cannot pick an
   old definition or return an ambiguous-function error.

`lib/store.ts#saveGuestClientFromOrder` now tolerates `23505` (a concurrent
checkout created the `clients` row first) and folds the order into the winner
instead of throwing after the order was created.

## Evidence

`supabase/tests/20261121_p0_hardening.sql` runs in one transaction and ends in
`ROLLBACK`: 59 checks, all passing against PostgreSQL 18.7 (PGlite wasm build)
with the four existing migrations applied first:

```
59 checks, 0 failed -> PASS
tables left behind after rollback: 0
```

Covered: happy path and totals, free-delivery threshold, out-of-stock and
above-stock failures leaving no partial writes, guarded decrement, coupon
discount/`max_uses`/`min_order`, idempotent retries, input validation, variants,
storewide-discount precision, `clients.phone` uniqueness and `ON CONFLICT`,
anon privilege probes at runtime, `authenticated` RLS isolation, and the RPC's
`service_role` grant.

Additional local runs: the migration applied twice in a row (idempotent), and
applied to a project that never ran `20261119_cleanup_cod_system.sql`.

## How to run the suite

On a **test** project (or the same project — it rolls back):

```sql
-- Supabase Dashboard → SQL Editor → paste → Run
-- or
psql "$TEST_DATABASE_URL" -f supabase/tests/20261121_p0_hardening.sql
```

The last result set is the verdict; any `FAIL` row shows the observed value.

## Rollout (not executed yet)

1. Run the catalog checks from the audit (`pg_policies`, `role_table_grants`,
   `pg_indexes`, `pg_proc`) against the live project and record them.
2. Take/verify a database backup (Dashboard → Database → Backups, and a
   `pg_dump` restorable into a scratch database).
3. Apply the test suite on the test project → must print `PASS`.
4. Apply `20261121_p0_hardening.sql` to production in the SQL Editor.
5. Re-run the test suite against production (it rolls back).
6. Negative live check: `curl "$URL/rest/v1/orders?select=id" -H "apikey: $ANON_KEY"`
   must now return `401/403`, not `200 []`.
7. Deploy the `lib/store.ts` change with the migration, then place one real COD
   order end to end and confirm stock decremented once.

## Remaining risks (not addressed here)

- **Concurrency** is proved by construction (row locks + guarded update) and by
  the guarded-decrement check, but a true two-session oversell test needs a
  real PostgreSQL; run it on the test project before production.
- `clients.phone` uniqueness is on the raw string: `06…`, `+2126…` and
  `002126…` still produce distinct rows. `clients.normalized_phone` exists but
  is not populated or unique.
- `createOrder()` still contains the `PGRST202` fallback that inserts an order
  with client-supplied totals. It is now unreachable (the RPC exists and is
  granted), but it is a latent stock bypass; removing it is the next step.
- Seed drift: `supabase/seed.sql` has 3 products while the live catalogue has
  16 with different slugs.
- `types/supabase.ts` is still absent, so table shapes are untyped.
