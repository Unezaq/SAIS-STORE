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

1. For a new project, apply `supabase/seed.sql`. For an existing project, apply `supabase/migrations/20261113_auth_rls.sql` once to add Auth-user links and correct owner policies without deleting rows.
2. Apply `supabase/migrations/20261113143000_store_offers.sql` to add order subtotal/delivery fields and editable delivery/promotion settings. It is safe to run after the seed script as its columns are guarded with `if not exists`.
3. To import the starter catalog from `data/store.json`, verify `.env.local` points to the intended Supabase project, then run `pnpm run db:seed-products -- --confirm`. This upserts products by slug; it does not upload image files. Product images referenced by `/products/...` must exist under `public/products/`.
4. Apply `supabase/migrations/20261115114500_optional_client_email.sql` to existing projects so customer email can be left blank.
5. Apply `supabase/migrations/20261116_customer_auth_system.sql` and `supabase/migrations/20261116_customer_auth_fixes.sql` for the independent customer accounts (`customers`, `customer_credentials`, `customer_sessions`, `orders.customer_id`).
6. Apply `supabase/migrations/20261117_place_order_storewide_promo.sql` so `place_order_rpc` applies the date-windowed storewide promotion exactly like `lib/pricing.ts`; without it the charged total ignores the sitewide discount.
7. Customer accounts do **not** use Supabase Auth. They live in the `customers` table with a bcrypt password and a server-side session cookie (`lib/auth/`), so there is nothing to enable in Authentication → Sign In / Providers for customers. Email is optional and stored only as contact information. Customer data is read with the service role on the server, after `getCustomerFromSession()` validates the cookie.
8. Create the administrator manually — the automatic `ADMIN_BOOTSTRAP_EMAIL` bootstrap is not used any more. Create an Auth user with the owner's email in the Supabase dashboard, then promote it from the SQL editor:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'owner@example.com';
   ```

   The same can be done with the Auth Admin API (`PUT /auth/v1/admin/users/{id}` with
   `{"app_metadata":{"role":"admin"}}`). Then sign in at `/admin/login`. Never assign this role from browser code or `user_metadata`.
9. Orders are attached to customers through `orders.customer_id`; the legacy `orders.auth_user_id` column is kept for old rows and read as a fallback (`getOrderForCustomerOrLegacy`).

`client_accounts` and `admin_accounts` are not used for authentication and intentionally have no client-facing RLS policies. Do not add password credentials or service-role keys to browser code.

## Bundler and PWA

`pnpm dev` and both production build scripts explicitly use Webpack because `@serwist/next` installs a Webpack service-worker compilation hook. Production builds generate `public/sw.js`; Serwist registration is enabled for production and disabled during development. Verify offline behavior against a production build, not the development server.
