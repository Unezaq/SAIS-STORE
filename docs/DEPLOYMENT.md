# Production deployment

## Required environment variables

Set the required base variables for local development and in both Vercel Production and Preview. Set the optional bootstrap email only in Production:

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
4. Set the Supabase Auth Site URL and allowed redirect URLs to include the deployed site's `/auth/callback` URL. Add each Preview origin that should support email confirmation.
5. To bootstrap the first admin through registration, set `ADMIN_BOOTSTRAP_EMAIL` to the owner's email in Vercel Production, register with that address, and confirm the email. The app grants `app_metadata.role = "admin"` only if no admin already exists. Otherwise, create the administrator as a Supabase Auth user and assign `app_metadata.role = "admin"` using the Supabase Auth Admin API from a trusted server or administrative environment. Never assign this role from browser code or `user_metadata`.
6. Customer profiles and orders are linked to verified Supabase Auth user IDs. Existing profile rows remain unlinked until the customer verifies their email and signs in through the callback.

`client_accounts` and `admin_accounts` are not used for authentication and intentionally have no client-facing RLS policies. Do not add password credentials or service-role keys to browser code.

## Bundler and PWA

`pnpm dev` and both production build scripts explicitly use Webpack because `@serwist/next` installs a Webpack service-worker compilation hook. Production builds generate `public/sw.js`; Serwist registration is enabled for production and disabled during development. Verify offline behavior against a production build, not the development server.
