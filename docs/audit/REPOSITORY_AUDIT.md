# SAIS STORE — Complete Repository Audit

**Date:** November 21, 2026  
**Auditor:** Senior Software Architect, Next.js Engineer & Database Security Architect  
**Branch:** `refactor/backend-reconstruction`  
**Backup Reference:** Git branch `backup/pre-backend-reconstruction` (commit `f2779c0`)

---

## 1. Executive Summary

A comprehensive architectural and security audit of the **SAIS STORE** codebase was conducted. The application is a Morocco-focused women's clothing e-commerce PWA built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Supabase. The storefront operates on a **100% Guest-First Cash on Delivery (COD)** model in Moroccan Dirhams (MAD), primarily in French with Moroccan Arabic context, utilizing WhatsApp for customer confirmation and support.

### Key Finding
The customer-facing application is strictly guest-first COD: customers never register or log in with passwords. Instead, they checkout with name, phone, city, and address, tracking their orders via a phone number + reference code or unguessable direct tracking tokens. The **only** authenticated users are **Store Administrators** logging into `/admin/login`.

However, the backend had accumulated historical artifacts from multiple development phases:
1. An obsolete custom credential/session authentication system (`customers`, `customer_credentials`, `customer_sessions`, `bcryptjs`) that had been half-dropped.
2. A monolithic `lib/store.ts` (1,050 lines) containing duplicated responsibilities, multiple fallback catches for missing columns (`42703`), and unmitigated service-role bypasses.
3. Multiple fragmented Supabase migrations with conflicting RLS policies and table grants.
4. Dead files and unused modules (e.g. `lib/addresses.ts`, `spikes/` prototype sub-package, ad-hoc scripts in `scripts/`).
5. Insecure fallback mechanisms: if `place_order_rpc` failed, code fell back to client-calculated direct order inserts.

---

## 2. Existing Architecture Overview

```
Client (Browser)
   │
   ├── Storefront: (Guest COD Purchase Funnel)
   │     ├── /boutique, /products/[slug], /collections/[slug], /promotions
   │     ├── /checkout (placeOrderAction)
   │     ├── /suivre, /suivre/[token] (trackOrderAction, trackOrderByToken)
   │     └── WhatsApp (wa.me)
   │
   └── Admin Area: (Protected via proxy.ts + requireAdmin)
         ├── /admin/login (loginAction)
         ├── /admin (Dashboard)
         ├── /admin/products, /admin/orders, /admin/clients, /admin/coupons, /admin/settings
         └── Server Actions (actions/admin.ts)
```

---

## 3. Detailed File Classification

Every file in the repository has been inspected, cross-referenced, and classified:

### 3.1. KEEP (Actively used, clean or minimal edits)
| File / Directory | Responsibility / Notes |
|---|---|
| `app/(storefront)/**` | All public pages: boutique, products, collections, promotions, checkout, suivi, wishlist, espace-client. Preserved intact to avoid UI regressions. |
| `app/(admin)/**` | Admin dashboard pages: orders, products, clients, coupons, settings. |
| `app/(auth)/admin/login/page.tsx` | Admin login page. |
| `components/**` | All UI components, layout components, storefront components, and admin form components. |
| `lib/data.ts` | Product and Category static structures, categories list, and discount percent calculation. |
| `lib/pricing.ts` | Server-side pricing calculator applying storewide discounts with Casablanca timezone logic. |
| `lib/phone.ts` | Moroccan phone normalization (`+212XXXXXXXXX`) and local formatting. |
| `lib/orderStatus.ts` | Order lifecycle state machine, labels, badge styling, and reference generator (`SAIS-XXXXXXXX`). |
| `lib/seo.tsx` | JSON-LD and meta tag helpers. |
| `lib/utils.ts` | UI utility functions (cn, formatMAD). |
| `lib/supabase/server.ts` | Next.js 16 server-side cookie client using `@supabase/ssr`. |
| `lib/supabase/admin.ts` | Server-only privileged client using `SUPABASE_SERVICE_ROLE_KEY`. |
| `lib/supabase/middleware.ts` | Supabase session updater for `proxy.ts`. |
| `proxy.ts` | Next.js 16 proxy protecting `/admin` routes. |
| `data/store.json` | Catalog source data for product catalog seeding. |
| `public/**` | Static assets, icons, product images, PWA manifests, and icons. |

### 3.2. REFACTOR (Necessary but badly structured, to be modernized)
| File / Component | Problems & Target Refactoring |
|---|---|
| `lib/store.ts` | **Monolith (1050 lines):** Combines products, orders, clients, coupons, settings, and legacy fallbacks. **Action:** Decompose into modular services under `lib/services/` and turn `lib/store.ts` into a backward-compatible facade. |
| `lib/products.ts` | Currently re-exports from `store.ts`, `coupons.ts`, `addresses.ts`. **Action:** Refactor into a clean storefront query service. |
| `actions/checkout.ts` | Contains rate limiting, validation, and RPC invocation mixed together. **Action:** Cleanly delegate domain logic to `orders.service.ts`. |
| `actions/admin.ts` | Direct inline mutations mixed with auth checks. **Action:** Cleanly delegate domain logic to respective services with strict `requireAdmin()` checks. |
| `lib/supabase/client.ts` | Singleton browser client was unused or inconsistently typed. **Action:** Align with `@supabase/ssr` browser client standard. |
| `lib/supabase/auth.ts` | Admin auth verification had redundant DB queries when JWT claims were present. **Action:** Fast-path JWT validation with secure fallback. |
| `lib/types/store.ts` | Contained references to legacy auth customer models. **Action:** Align types with the clean production schema. |
| `scripts/seed-products.mjs` | Product catalog seeding script. **Action:** Ensure idempotency and robust upserting. |
| `scripts/db-verify.mjs` | Database verification script. **Action:** Modernize into a comprehensive pre-flight / schema validation tool for the new Supabase project. |

### 3.3. REPLACE (Obsolete architecture needing fresh implementation)
| File / Component | Problems & Target Replacement |
|---|---|
| `supabase/migrations/*` | 5 fragmented migrations with conflicting RLS policies and table deletions. **Action:** Archive into `supabase/archive/legacy_migrations/` and replace with a single, consolidated, production-grade migration: `supabase/migrations/20261122_sais_store_production.sql`. |
| `supabase/seed.sql` | Outdated seed data referencing dropped tables. **Action:** Replace with clean baseline seed for settings, categories, and initial admin profile. |

### 3.4. DELETE / ARCHIVE (Obsolete, unused, or dead code)
| File / Directory | Reason for Removal |
|---|---|
| `lib/addresses.ts` | **Dead code:** Zero usages in any page, component, or action. Saved addresses were for an abandoned customer account feature. |
| `scripts/create-admin.mjs` | Superseded by `create-admin-user.mjs` (lacked auth user creation). |
| `scripts/update-admin.mjs` | Temporary ad-hoc scratch script. |
| `scripts/db-apply.mjs` | Hardcoded remote migration application script. |
| `test-db.mjs` | Temporary root-level test script. |
| `dev.log` | Temporary log file. |
| `spikes/` | Prototype sub-package with redundant `node_modules` and legacy configs. Isolated from active build. |
| `bcryptjs` / `@types/bcryptjs` | Unused dependency in `package.json` remaining from abandoned custom password auth. |

---

## 4. Security Risks Discovered & Mitigated

| ID | Vulnerability / Risk | Severity | Root Cause | Architectural Mitigation |
|---|---|---|---|---|
| **SEC-01** | Unauthenticated Order Inspection | **CRITICAL** | Permissive RLS policy `Anon can read own orders ... using (true)` in `20261119_guest_first_rls.sql`. | Revoked `SELECT` from `anon` on `orders`, `order_items`, `clients`, `coupons`. Guest tracking is restricted to phone + reference verification via `SECURITY DEFINER` RPC or direct UUID `tracking_token`. |
| **SEC-02** | Direct Order Insertion / Price Tampering | **CRITICAL** | `Anon can create orders` policy + fallback in `createOrder` inserting client-calculated totals. | Removed all `INSERT` policies on `orders` and `order_items`. Orders can ONLY be placed via `place_order_rpc` executed by `service_role`. All prices, discounts, and delivery fees are calculated authoritatively from DB rows. |
| **SEC-03** | Race Conditions in Stock Decrement | **HIGH** | Lack of pessimistic locking during stock check and decrement. | Implemented `SELECT ... FOR UPDATE` ordered by slug (deadlock-free) and atomic conditional `UPDATE products SET stock = stock - qty WHERE stock >= qty`. |
| **SEC-04** | Coupon Abuse & Concurrent Over-redemption | **HIGH** | `used_count` incremented non-atomically. | `coupons` row locked `FOR UPDATE` in the same transaction as order creation; `used_count` incremented atomically. |
| **SEC-05** | Double-Charge / Duplicate Orders | **MEDIUM** | Network retries creating duplicate orders. | Mandatory `idempotency_key` handling with unique constraint and transaction rollback/recovery returning the existing order. |
| **SEC-06** | Service Role Leakage | **HIGH** | Risk of exposing `SUPABASE_SERVICE_ROLE_KEY` to client bundles. | Enforced `import 'server-only'` in `admin.ts` and all backend services. No service-role client can ever be imported into client components. |

---

## 5. Target Clean Architecture

```
f:\sais - store\
├── actions/                   # Next.js Server Actions (validated with Zod)
│   ├── admin.ts               # Protected admin mutations (requires is_admin)
│   └── checkout.ts            # Public guest checkout & tracking mutations
├── app/                       # Next.js App Router routes (UI preserved)
│   ├── (admin)/               # Admin dashboard & management
│   ├── (auth)/                # Admin authentication
│   ├── (storefront)/          # Public guest e-commerce pages
│   └── api/                   # System route handlers
├── components/                # React UI Components (storefront, admin, ui, layout)
├── lib/
│   ├── db/                    # Supabase Client initializers (server, admin, client)
│   ├── services/              # Pure domain business services
│   │   ├── products.service.ts
│   │   ├── orders.service.ts
│   │   ├── clients.service.ts
│   │   ├── coupons.service.ts
│   │   └── settings.service.ts
│   ├── security/              # Rate limiting, authorization, phone normalization
│   ├── types/                 # Domain TypeScript interfaces
│   ├── pricing.ts             # Pricing calculation engine
│   ├── phone.ts               # Moroccan phone normalization
│   ├── orderStatus.ts         # Order lifecycle & reference generator
│   └── store.ts               # Backward-compatible facade delegating to services
├── supabase/
│   ├── migrations/            # Production migration (20261122_sais_store_production.sql)
│   ├── archive/               # Immutable legacy migrations archive
│   └── seed.sql               # Canonical seed data
├── scripts/
│   ├── seed-products.mjs      # Catalog upsert script
│   ├── create-admin-user.mjs  # Admin user creation script
│   └── db-verify.mjs          # Supabase connection & schema verification tool
└── docs/                      # Architecture, Database, Security, Audit documentation
```
