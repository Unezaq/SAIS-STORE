# SAIS STORE — Security Model & Threat Mitigation

**Version:** 2.0  
**Status:** Enforced  
**Standards:** OWASP Top 10 for E-Commerce, Supabase RLS Hardening

---

## 1. Security Philosophy & Threat Matrix

| Threat | Target Asset | Attack Vector | Security Control |
|---|---|---|---|
| **Price Tampering** | Orders & Financial Totals | Client submits tampered item prices, modified delivery fees, or fake discounts. | **Zero Client Trust:** `place_order_rpc` queries current product prices and settings inside PostgreSQL. Browser prices are ignored. |
| **Inventory Exhaustion (Overselling)** | Product Stock | Concurrent checkouts for the last available item in stock. | **Pessimistic Row Locking:** Products and variants locked via `SELECT ... FOR UPDATE` in alphabetical slug order (deadlock-free); stock checked and decremented atomically. |
| **Coupon Over-Redemption** | Promo Coupons | Rapid simultaneous requests redeeming limited-use coupons. | **Coupon Row Locking:** `coupons` row locked `FOR UPDATE`; `used_count` checked against `max_uses` and incremented in the same atomic transaction. |
| **PII Data Harvest** | Customer Orders, Phones, Addresses | Unauthenticated user querying `/rest/v1/orders` or `/rest/v1/clients` with anon key. | **Strict RLS & Privilege Revocation:** `anon` has 0 permissions to SELECT from `orders`, `order_items`, `clients`, `coupons`. |
| **Replay / Double Checkout** | Orders & Inventory | Double-clicks or mobile network retries creating duplicate orders. | **Idempotency Protection:** Unique `idempotency_key` constraint; retry returns the original order without recreating line items or double-decrementing stock. |
| **Admin Privilege Escalation** | Admin Area (`/admin/*`) | Normal user attempting to access administrative management routes. | **Multi-Layer Gate:** `proxy.ts` (Edge check of JWT claims) + Server Component `requireAdmin()` + Database RLS (`is_admin()` checking profiles and JWT metadata). |
| **Secret Leakage** | Service Role Secret | Bundling `SUPABASE_SERVICE_ROLE_KEY` into browser bundles. | **Strict Server Isolation:** `import 'server-only'` enforced on `lib/db/admin.ts` and all service files. Build fails if imported into client components. |

---

## 2. Row Level Security (RLS) Specification

| Table | `anon` / Public | Authenticated (`customer`) | Authenticated (`admin`) | `service_role` |
|---|---|---|---|---|
| `settings` | `SELECT` (all rows) | `SELECT` | `ALL` (full CRUD) | `BYPASS` |
| `products` | `SELECT` (`is_active = true`) | `SELECT` (`is_active = true`) | `ALL` (full CRUD) | `BYPASS` |
| `product_variants` | `SELECT` (all rows) | `SELECT` | `ALL` (full CRUD) | `BYPASS` |
| `orders` | **DENIED** | `SELECT` (own orders if linked) | `ALL` (full CRUD) | `BYPASS` |
| `order_items` | **DENIED** | `SELECT` (own order items) | `ALL` (full CRUD) | `BYPASS` |
| `order_status_history`| **DENIED** | `SELECT` (own orders) | `ALL` (full CRUD) | `BYPASS` |
| `clients` | **DENIED** | **DENIED** | `ALL` (full CRUD) | `BYPASS` |
| `coupons` | **DENIED** | **DENIED** | `ALL` (full CRUD) | `BYPASS` |
| `profiles` | **DENIED** | `SELECT`, `UPDATE` (own row only) | `ALL` (full CRUD) | `BYPASS` |

---

## 3. Database Function Security & Execution Grants

```sql
-- Revoke all public execution by default
revoke execute on all functions in schema public from public, anon, authenticated;

-- Allow anonymous & public callers only what is strictly required for guest UX
grant execute on function public.normalize_moroccan_phone(text) to public, anon, authenticated, service_role;
grant execute on function public.order_reference_for_tracking(text) to public, anon, authenticated, service_role;
grant execute on function public.get_order_for_tracking(text, text) to anon, authenticated, service_role;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated, service_role;

-- place_order_rpc is EXCLUSIVELY granted to service_role (invoked via Next.js Server Action)
grant execute on function public.place_order_rpc(uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text) to service_role;

-- is_admin helper is granted to authenticated users for RLS evaluation
grant execute on function public.is_admin() to authenticated;
```

---

## 4. Application Rate Limiting & Denial of Service Protection
- Public checkout submissions are throttled per Moroccan phone number (max 10 orders per hour per phone).
- Tracking lookups are rate-limited to prevent brute-force enumeration of order references.
- All client-side text inputs are sanitized, trimmed, and bounded by maximum lengths in Zod schemas.
