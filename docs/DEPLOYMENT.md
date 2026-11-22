# Production deployment

## Required environment variables

Set the required base variables for local development and in both Vercel Production and Preview. `ADMIN_BOOTSTRAP_EMAIL` is optional and only kept for the legacy Supabase-Auth callback; the administrator is now created manually (see step 8):

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical origin for the deployment; use the preview origin in Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase secret/service-role key; never prefix it with `NEXT_PUBLIC_` |
| `ADMIN_BOOTSTRAP_EMAIL` | Server only | Optional owner email; only this confirmed account can become the first admin. Configure in Production only. |

Use `.env.example` as the local template. Do not copy real keys into Git. Vercel's normal Next.js output settings are sufficient; use `pnpm install --frozen-lockfile` for installation and `pnpm run vercel-build` for the build.

If a Supabase service-role/secret key has ever been exposed, revoke it and update `SUPABASE_SERVICE_ROLE_KEY` in Vercel before deploying.

WhatsApp contact, delivery fee, free-delivery threshold, and temporary storewide promotion are managed in Admin → Settings. Defaults are 22 MAD delivery and free delivery from 3 pieces; the server recalculates both prices and delivery when an order is submitted.

## Supabase setup

1. For both new and existing projects, apply the canonical consolidated production schema: `supabase/migrations/20261122_sais_store_production.sql` in the Supabase SQL Editor. This script creates and hardens all 9 core tables (`settings`, `products`, `product_variants`, `profiles`, `clients`, `coupons`, `orders`, `order_items`, `order_status_history`), all indexes, RLS policies, and the 6 atomic RPC functions (`is_admin`, `normalize_moroccan_phone`, `order_reference_for_tracking`, `validate_coupon`, `get_order_for_tracking`, `place_order_rpc`).
2. To import the starter catalog from `data/store.json`, verify `.env.local` points to the intended Supabase project, then run `pnpm run db:seed-products -- --confirm`. This upserts products by slug; it does not upload image files. Product images referenced by `/products/...` must exist under `public/products/`.
3. Customer accounts follow a guest-first Moroccan e-commerce model with CRM directory in `clients` (indexed by unique phone number) and order tracking by phone + reference or unguessable token. No external passwords or third-party SMS providers are required for visitors to purchase.
4. Administrator account setup:
   Create an Auth user with the administrator's email in Supabase Authentication, then promote the user to admin via the SQL Editor:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'admin@your-domain.ma';

   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@your-domain.ma');
   ```

   Alternatively, setting `ADMIN_BOOTSTRAP_EMAIL` in the environment allows the initial confirmed user with that email to be promoted automatically on first login. Then sign in at `/admin/login`. Never assign administrative roles from client browser code.

5. Privilege isolation: All customer and order tables are protected by Row Level Security (RLS) allowing full access only to authenticated administrators (`is_admin()`). Public checkout operations run strictly through the atomic `place_order_rpc` SECURITY DEFINER function with pessimistic row locks on products and settings. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

## Bundler and PWA

`pnpm dev` and both production build scripts explicitly use Webpack because `@serwist/next` installs a Webpack service-worker compilation hook. Production builds generate `public/sw.js`; Serwist registration is enabled for production and disabled during development. Verify offline behavior against a production build, not the development server.
