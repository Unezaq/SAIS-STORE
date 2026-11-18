# AUDIT.md — SAIS Store

## Resolved mismatches (fixed in supabase/migrations/20261118_sais_store_schema.sql)
All code-vs-SQL mismatches from the first audit are resolved by the single consolidated migration:

1. `products.id` — now `uuid` (was text in seed, uuid in old migration 01). `product_variants.product_id uuid → products(id) uuid` FK is consistent.
2. `products.colors` = `jsonb` (matches code sending `[{name, hex}]`); `sizes`/`features` = `text[]` (matches code string[]).
3. `settings.delivery_fee / free_delivery_min_items / storewide_discount_percent` — `numeric` (code reads as number, OK).
4. `orders.discount_total` — column present in orders table.
5. `order_status_history` — single schema `(id, order_id, status, note, created_at)`, matching code's `updateOrderStatus` insert.
6. `orders.city` — `NOT NULL` with no default; legacy backfilled to 'Kenitra'; checkout supplies it.
7. `clients.email` — nullable, no unique constraint (matches code).

## Security hardening applied
8. **No public INSERT on `orders` or `order_items`.** Orders created only via `place_order_rpc` (SECURITY DEFINER, service_role). Anon key cannot bypass stock/coupon/price validation.
9. `place_order_rpc` — `EXECUTE` revoked from `anon, authenticated, public`. Called server-side only.
10. `is_admin()` helper — `SECURITY DEFINER`, `STABLE`, `search_path = public`. Admin = `app_metadata.role='admin'` OR `profiles.role='admin'` (profiles.id = auth.uid()). Used in all RLS policies instead of inline subqueries. `profiles.id` (not `user_id`) is used for the auth.uid() match.
11. `customers` / `customer_credentials` / `customer_sessions` — NO public SELECT/INSERT/UPDATE policies. Defense-in-depth; service_role only.
12. `coupons` — `for all to authenticated using (false)` (not publicly selectable).
13. `orders.city` default 'Casablanca' removed → NOT NULL, no default.

## Remaining security issues (not DB — code/runtime)
14. Rate limiting (checkout, customer auth) is in-memory — no protection across server instances (code warns).
15. `updateOrderStatus` updates `orders` then writes `order_status_history`; if the history insert fails, the status change is already committed — only logged, no rollback.
16. `SUPABASE_SERVICE_ROLE_KEY` read via `process.env` but NOT validated by `lib/env.ts` → runtime crash if missing.
17. `validate_coupon` still executable by anon (needed for guest checkout in `actions/checkout.ts`). Phase 2: move to service_role + rate limit.

## Dead code
18. `admin_accounts` / `client_accounts` tables: not in consolidated migration, no code reads them.
19. `lib/utils/crypto.ts` — customer-auth uses `lib/auth/password` instead; appears unused.
20. `lib/auth/tokens.ts` `generateSessionToken`/`hashSessionToken` — `customers.ts` uses `randomUUID` directly; appears unused.
21. `spikes/next.config.ts` — experimental config, not imported anywhere.
22. `app/api/ping/route.ts` — Google sitemap ping retired (410 on POST); obsolete endpoint.

## Unverified (SQL not executed against a DB)
- Migration syntax not run against a real Supabase project. Supabase CLI not installed.
- On an EXISTING project where `products.id` is still text, the text→uuid change cannot be applied in place with data — fresh project required.
- Unique index creation on `orders.tracking_token` / `idempotency_key` will fail if existing rows have duplicates.
- `is_admin()` called from RLS policies not validated against a live DB.
