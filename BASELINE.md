# BASELINE — SAIS STORE Security & Integrity Repair
**Date:** Tue Nov 24 2026  
**Branch:** `main` (up to date with `upstream/main`)  
**Commit:** `d909d4c` (base) + repair changes (working tree, not yet committed)  
**Status:** All fixes implemented, tested, build passing. Awaiting production migration execution.

---

## A. Build / TypeScript / Test Status

| Check | Command | Result |
|-------|---------|--------|
| Build | `pnpm build` (`next build --webpack`) | **PASS** — TypeScript check passes, 32 static pages |
| Tests | `pnpm test` (`vitest run`) | **PASS** — 11 files, 59 tests, all passing |
| Lint | N/A | **UNVERIFIED** — eslint unavailable on TypeScript 7.0 |

---

## B. Migrations Created (6 new files, not yet applied to production)

| Migration | Purpose |
|-----------|---------|
| `20261124_inventory_ledger_and_order_links.sql` | `inventory_ledger` table (partial unique index on idempotency_key), `coupon_redemptions` table, `auth_user_id` on orders, expanded statuses (`returned`, `refunded`), RLS + grants |
| `20261124_rate_limiting.sql` | `rate_limits` table, `check_rate_limit()` SECURITY DEFINER RPC, `cleanup_rate_limits()`, RLS + grants |
| `20261124_place_order_rpc_integrity.sql` | Hardened `place_order_rpc`: duplicate cart line aggregation, no double-decrement, savepoint-based idempotency, correct final prices, inventory ledger, coupon redemption records |
| `20261124_rls_customer_order_isolation.sql` | Customer RLS policies on orders/order_items/order_status_history, strict profiles update (no self-promote to admin), grants |
| `20261124_cancellation_and_returns.sql` | `order_cancellations` + `order_returns` tables, `coupon_code` on orders, `is_order_owner()`, `cancel_order_rpc()`, `return_order_rpc()`, RLS + grants |
| `20261124_coupon_per_user_limits.sql` | `redeemed_phone` on coupon_redemptions, `validate_coupon()` updated with per-user/per-phone limit enforcement |

---

## C. Application Changes (11 modified files)

### Security
- **`actions/customer-account.ts`**: Registration no longer auto-confirms email (`email_confirm: false`), no admin role assigned; `getCustomerOrders()` uses RLS-isolated `auth_user_id` query instead of admin-client `getOrdersByPhone()`
- **`actions/checkout.ts`**: `placeOrderAction` passes `auth_user_id` to link orders to accounts; `trackOrderAction` uses `get_order_for_tracking` RPC with exact matching (eliminated phone-suffix matching); rate limit calls are `await`ed (now async)
- **`app/api/upload/route.ts`**: Requires admin authentication (`assertAdmin`), uses Supabase Storage instead of local filesystem, `upsert: false` prevents file replacement
- **`lib/security/rateLimit.ts`**: Database-backed fixed-window rate limiting via `check_rate_limit()` RPC (replaces in-memory Map), fail-open on DB error

### Inventory / Stock Integrity
- **`lib/services/orders.service.ts`**: `updateOrderStatus()` routes `annulee`/`returned` through `cancel_order_rpc`/`return_order_rpc`; added `cancelOrder()`, `returnOrder()`, `getOrdersByUserId()`, `getOrderForTracking()`; imported `createClient`
- **`lib/store.ts`**: Exports new order functions

### Order Lifecycle
- **`lib/orderStatus.ts`**: Added `returned`, `refunded` statuses; helper functions `isTerminalStatus()`, `restocksStock()`, `isCancellable()`
- **`actions/admin.ts`**: `updateOrderStatusAction` passes actor info; added `cancelOrderAction`, `returnOrderAction`; status schema includes new statuses
- **`components/storefront/OrderStatusBadge.tsx`**: Added icons for `returned`, `refunded`

---

## D. Verification Evidence

```
$ pnpm test
Test Files  11 passed (11)
   Tests  59 passed (59)

$ pnpm build
✓ Compiled successfully
✓ Finished TypeScript
✓ Generating static pages (32/32)
```

---

## E. Data Safety

| Item | Status |
|------|--------|
| Existing orders | **PRESERVED** — no migrations modify or delete existing order rows |
| Product/variant stock | **NOT MODIFIED** — migrations add ledger tables but don't change existing stock values |
| Coupon history | **PRESERVED** — `coupon_redemptions` is a new table; existing `used_count` untouched |
| Production operation pending | **MIGRATION EXECUTION** — 6 new migrations must be applied to production Supabase (staging first) |

---

## F. Remaining Items

| Item | Status |
|------|--------|
| Production migration execution | REQUIRES USER APPROVAL — run 6 migrations on staging, then production |
| RLS validation against live DB | UNVERIFIED — no production DB access available |
| Concurrency testing under load | UNVERIFIED — requires production-like environment |
| `SUPABASE_SERVICE_ROLE_KEY` env validation | NOT FIXED — still read via `process.env` (noted in AUDIT.md #16) |
| Coupon per-user limit for guests | FIXED — phone-based tracking via `redeemed_phone` |

---

## G. Deployment Decision

**NOT READY — BLOCKERS REMAIN**

The 6 migrations must be executed against a staging Supabase project and validated before production deployment. Production deployment requires separate verification and explicit authorization.
