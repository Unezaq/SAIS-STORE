# AUDIT.md — SAIS Store

## Mismatches: code vs SQL
1. `products.id`: seed.sql = `text`, migration `01` = `uuid`. `product_variants.product_id text → products(id)` FK would fail if id is uuid.
2. `products.colors/sizes/features`: seed = `jsonb`, migration `01` = `text[]`. Code sends `colors` as object[] and `sizes`/`features` as string[]. Matches migration for sizes/features; colors object[] vs text[] mismatch.
3. `settings.delivery_fee / free_delivery_min_items / storewide_discount_percent`: seed = integer, migration `01` = numeric. Code reads as number (OK).
4. `orders.discount_total`: present in seed.sql, ABSENT in migration `01` orders table. Code's `OrderRow` + `place_order_rpc` read/write `discount_total` → column missing unless seed applied.
5. `order_status_history`: migration `20261115` = `(order_id, status, note)`; migration `01` = `(order_id, new_status, previous_status, changed_by)`. Code's `updateOrderStatus` inserts `{order_id, status, note}` → matches `20261115`, not migration `01`.
6. `orders.city`: migration `01` adds NOT NULL `city` (default Casablanca). Code `OrderRow` has no city; RPC insert omits it (uses default) — undocumented.
7. `clients.email`: seed NOT NULL; migration `20261115114500` makes nullable + drops unique constraint. Code allows null email (OK).

## Security issues
8. No root `middleware.ts`/`proxy.ts` session-refresh path verified (AGENTS.md says `proxy.ts` replaces `middleware.ts`).
9. Rate limiting (checkout, customer auth) is in-memory — no protection across server instances (code warns).
10. `updateOrderStatus` updates `orders` then writes `order_status_history`; if the history insert fails, the status change is already committed — only logged, no rollback.
11. `SUPABASE_SERVICE_ROLE_KEY` read via `process.env` but NOT validated by `lib/env.ts` → runtime crash if missing.
12. `customers` RLS policy "Customers are publicly readable" (anon read active customers) created in `20261116_customer_auth_system`, dropped in `20261116_customer_auth_fixes` — order-dependent; verify final state.

## Dead code
13. `admin_accounts` / `client_accounts` tables: seed-marked "not used for authentication", no RLS policies, no code reads them.
14. `lib/utils/crypto.ts` (bcrypt hash/verify) — customer-auth uses `lib/auth/password` instead; `crypto.ts` appears unused.
15. `lib/auth/tokens.ts` `generateSessionToken`/`hashSessionToken` — `customers.ts` uses `randomUUID` directly; appears unused.
16. `spikes/next.config.ts` — experimental config, not imported anywhere.
17. `app/api/ping/route.ts` — Google sitemap ping retired (410 on POST); obsolete endpoint.
