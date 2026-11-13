# Supabase (Auth, DB, Storage, RLS)

## Versions
- **@supabase/supabase-js**: 2.119.0
- **@supabase/ssr**: 0.12.7

## Sources
- Supabase SSR guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Custom claims: https://supabase.com/docs/guides/auth/jwts#custom-access-token-hook

## Install
```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

## Client Setup (Verified Pattern)

### Browser Client (`utils/supabase/client.ts`)
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

### Server Client (`utils/supabase/server.ts`)
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // async in Next.js 15+
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot write cookies; Proxy refreshes the session.
          }
        },
      },
    }
  )
}
```

### Proxy (middleware) (`proxy.ts` in Next.js 16)
- Refresh auth tokens on every request
- Guard `/admin` routes by checking the verified `app_metadata.role` claim
- Use `supabase.auth.getUser()` NOT `getSession()` on server

## Important Rules

1. **`getUser()` over `getSession()`**: `getUser()` validates against Supabase Auth server; `getSession()` only reads JWT locally (can be spoofed).
2. **Admin via Custom Access Token Hook**: Create `user_roles` table → hook function injects role into `app_metadata` in JWT → RLS reads from `auth.jwt()`.
3. **Never trust `user_metadata`** for authorization — users can modify it client-side.
4. **RLS policy pattern for admin**:
   ```sql
   (select auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
   ```
   Wrap in `(select ...)` subquery for performance (evaluated once per query).
5. **Token refresh lag**: Role changes don't take effect until next token refresh/login.
6. **Storage RLS**: Buckets have their own policies. Use signed URLs for private images.
7. **Supabase CLI for migrations**: `supabase init`, `supabase migration new`, `supabase db push`.
8. **Type generation**: `supabase gen types typescript --project-id <id> > types/supabase.ts`

## DO / DON'T

| DO | DON'T |
|---|---|
| Use `getUser()` on server | Trust `getSession()` for auth checks |
| Put role in `app_metadata` via hook | Put role in `user_metadata` |
| Use `(select auth.jwt()...)` in RLS | Call functions/joins in RLS policies |
| Validate with Zod in server actions | Trust client-sent data |
| Use service_role key only server-side | Expose service_role to client |
| Use signed URLs for private storage | Make storage buckets fully public |

## RLS Strategy for This Project
- **products, settings**: anon and authenticated users can SELECT; admins can manage rows.
- **orders**: authenticated customers can SELECT rows linked to their Auth user ID; admins can manage rows. Order creation is server-side.
- **clients**: customers can SELECT their linked profile; admins can manage profiles.
- **client_accounts, admin_accounts**: no client-facing policies; these legacy tables are not used for authentication.

## Project Environment Setup

1. Open the project in the Supabase Dashboard.
2. In **Project Settings → API**, copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
3. In **Project Settings → API Keys**, copy the **Publishable key** into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Put the values in `.env.local` at the repository root, next to `package.json`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   SUPABASE_SERVICE_ROLE_KEY=<server-only-secret-key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Replace every `<...>` value with the real value before starting the app. Restart `pnpm dev` after changing environment variables.

`SUPABASE_SERVICE_ROLE_KEY` is required for server-only order creation and customer profile linking. Keep it server-only: never add the `NEXT_PUBLIC_` prefix or commit it. Create admins as Supabase Auth users and assign `app_metadata.role = "admin"` only through the Auth Admin API from a trusted environment.

Keep `.env.local` private and untracked. The publishable key is intended for app clients; never use a secret/service-role key as a publishable key.

Manage the WhatsApp contact, delivery fee, free-delivery threshold, and storewide promotion under Admin → Settings. For a new project, apply `supabase/seed.sql`. For an existing schema, apply `supabase/migrations/20261113_auth_rls.sql` and then `supabase/migrations/20261113143000_store_offers.sql`.

