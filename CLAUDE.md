# CLAUDE.md — SAIS Store

> Women's clothing online store (PWA), Morocco-focused. French UI.

## Stack (exact versions — package.json)
- next 16.4.5 — App Router. `proxy.ts` (root) replaces `middleware.ts`.
- react 19.3.1 / react-dom 19.3.1
- typescript 7.0.2
- tailwindcss 4.3.5 — CSS-first config, `@theme` in `app/globals.css`
- @supabase/supabase-js 2.119.0, @supabase/ssr 0.12.7
- lenis 1.3.27 (autoRaf: false, GSAP), gsap 3.15.1, @gsap/react 2.1.2
- motion 14.10.1 (import from `motion/react`)
- @tanstack/react-query 5.107.1
- zod 4.6.7 (v4 — use `z.email()` not `z.string().email()`)
- react-hook-form 7.91.0, @hookform/resolvers 7.0.3
- @serwist/next 9.5.13 + serwist 9.5.13 (PWA service worker)
- bcryptjs ^3.0.3

## Folder map
```
f:\sais - store\
├── app/
│   ├── (storefront)/        page.tsx, layout.tsx, loading.tsx
│   │   ├── account/         orders, profile
│   │   ├── boutique/        page
│   │   ├── checkout/        page
│   │   ├── collections/     page + [slug]
│   │   ├── espace-client/   page
│   │   ├── products/        [slug]
│   │   ├── promotions/      page
│   │   ├── suivre/          page + [token]
│   │   └── wishlist/        page
│   ├── (admin)/             layout.tsx, loading.tsx
│   │   └── admin/           page + clients, coupons, orders, products, settings
│   ├── (auth)/              admin/login, login, register
│   ├── api/ping/route
│   ├── auth/callback/route
│   ├── layout.tsx, loading.tsx, error.tsx, not-found.tsx
│   ├── globals.css, manifest.ts, providers.tsx, robots.ts, sitemap.ts, sw.ts, get-query-client.ts
├── components/   (ui, storefront, admin, layout)
├── lib/
│   ├── supabase/   client, server, admin, auth, middleware, bootstrap-admin
│   ├── auth/       customers, session, tokens, password, rate-limit, current-customer
│   ├── api/        (empty)
│   ├── utils/      crypto
│   ├── types/      store
│   ├── env.ts, store.ts, products.ts, addresses.ts, coupons.ts, data.ts,
│   │   gallery.ts, orderStatus.ts, phone.ts, pricing.ts, seo.tsx, utils.ts
├── hooks/
├── types/supabase.ts
├── actions/        admin, checkout, client, customer-auth, customer-profile
├── supabase/       migrations/, seed.sql
├── public/         icons, images
├── proxy.ts, next.config.ts, postcss.config.mjs, tsconfig.json, package.json, AGENTS.md
```

## Environment variables
Validated by `lib/env.ts` (client side only):
- `NEXT_PUBLIC_SUPABASE_URL` — required (`z.url()`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — required
- `NEXT_PUBLIC_SITE_URL` — required

Server-only (read via `process.env`, NOT validated by env.ts — crashes at runtime if missing):
- `SUPABASE_SERVICE_ROLE_KEY` — required for `createAdminClient()`
- `ADMIN_BOOTSTRAP_EMAIL` — optional, bootstraps first admin user

No `.env.local.example` found in repo.

## How to run
- `pnpm dev` — `next dev --webpack` (Serwist off)
- `pnpm build` — `next build --webpack` (Serwist on; this is the type check — no eslint on TS 7.0)
- `pnpm start` — `next start`
- `pnpm test` — `vitest run`
- `pnpm db:seed-products -- --confirm` — upsert catalogue from `data/store.json`

Migrations are applied manually in the Supabase SQL Editor. Never edit an applied migration — add a new dated file instead.

## Tables / columns used by code (single source: `supabase/migrations/20261118_sais_store_schema.sql`)
**products** — id (uuid), title, slug, slug_category, category_name, price, original_price, image_url, colors (jsonb), color_images (jsonb), sizes (text[]), fabric, features (text[]), badge, ref, description, is_active, stock, created_at, updated_at.

**settings** — id (pk=1), store_name, whatsapp_phone, delivery_text, payment_text, currency, delivery_fee (numeric), free_delivery_min_items, storewide_discount_percent, discount_start_date, discount_end_date, updated_at.

**orders** — id (text), auth_user_id, customer_id, client_email, client_name, customer_name, phone, city (NOT NULL, no default — checkout supplies it; legacy backfilled to 'Kenitra'), address, items (jsonb), subtotal, discount_total, delivery_fee, total, status, note, tracking_token (unique), order_number, idempotency_key (unique), created_at.
NO public INSERT on orders/order_items: creation only via place_order_rpc (service_role).

**clients** (legacy guest profiles) — id, auth_user_id, customer_id, email, first_name, last_name, phone, address, order_count, total_spent, created_at.

**coupons** — id, code (unique), type, value, min_order, starts_at, expires_at, max_uses, used_count, per_user_limit, is_active, created_at, updated_at.

**product_variants** — id, product_id → products(id), size, color, stock, price_adjustment, sku, created_at, updated_at.

**order_items** — id, order_id → orders(id), product_id → products(id), variant, name_snapshot, unit_price, quantity, line_total, created_at.

**order_status_history** — id, order_id → orders(id), status, note, created_at.

**customers** (independent auth, no auth.users) — id, full_name, email, normalized_email, phone, normalized_phone, city, address, is_active, created_at, updated_at.

**customer_credentials** — id, customer_id → customers(id), password_hash, password_updated_at, created_at.
**customer_sessions** — id, customer_id → customers(id), session_token_hash, expires_at, created_at, last_activity_at, revoked_at.

**profiles** (auth.users extension) — id → auth.users(id), full_name, phone, role ('customer'|'admin'), created_at, updated_at.
**addresses** — id, user_id → auth.users(id), label, full_name, phone, city, address, is_default, created_at, updated_at.

**admin_accounts / client_accounts** — legacy (seed-marked "not used for authentication"); no code reads them; retained in seed only as empty legacy tables (not in consolidated migration).

**Admin definition (RLS):** `profiles.role = 'admin'` OR `auth.jwt()->'app_metadata'->>'role' = 'admin'` (bridge during transition).

## RPCs (SECURITY DEFINER, `set search_path = public`)
- `place_order_rpc(p_auth_user_id, p_customer_id, p_client_email, p_client_name, p_customer_name, p_phone, p_address, p_items, p_note, p_coupon_code, p_idempotency_key)` → order_id, order_number, tracking_token, subtotal, discount_total, delivery_fee, total, status. Atomic: validate, stock (incl. variants), coupon, totals, insert order + items, decrement stock, increment coupon, history. `EXECUTE` revoked from anon/authenticated/public (called server-side via service_role only).
- `validate_coupon(p_code, p_subtotal)` → valid, discount_amount, message. Read-only; executable (called via SSR anon-capable client during guest checkout).
- `order_reference_for_tracking(p_order_id)` → text.
- `get_order_for_tracking(p_order_number, p_phone)` → limited safe order view; returns nothing when phone invalid or order not found.
- `normalize_moroccan_phone(p_value)` → text (immutable).

## Migration notes
- Single idempotent migration: `supabase/migrations/20261118_sais_store_schema.sql` (replaces all prior migrations; old files deleted). Safe to re-run.
- `products.id` is uuid. On an EXISTING project whose products.id is still text, the type cannot be altered in place with data — a fresh Supabase project is required (or a dedicated data migration first). All other columns are added idempotently via ALTER TABLE ... IF NOT EXISTS.
- `orders.city` is NOT NULL with no default; legacy rows backfilled to 'Kenitra' (store location). Checkout must supply city.
- No public INSERT on orders/order_items. Orders created only via place_order_rpc (service_role).

## Settings columns (no secrets)
store_name, whatsapp_phone (demo number, not a credential), delivery_text, payment_text, currency, delivery_fee, free_delivery_min_items, storewide_discount_percent, discount_start_date, discount_end_date, updated_at. No passwords/keys stored.

## Currency / locale
- MAD, `new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`
- Phone +212..., UI French primarily, Arabic support
