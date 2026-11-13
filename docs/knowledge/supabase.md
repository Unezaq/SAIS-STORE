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
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // OK in Server Components if middleware refreshes
        },
      },
    }
  )
}
```

### Proxy (middleware) (`proxy.ts` in Next.js 16)
- Refresh auth tokens on every request
- Guard `/admin` routes by checking `app_metadata.user_role`
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
- **products, collections**: anon can SELECT; admin can INSERT/UPDATE/DELETE
- **orders**: authenticated can INSERT own; authenticated can SELECT own; admin can SELECT/UPDATE all
- **site_content/settings**: anon can SELECT; admin can UPDATE
- **Storage (product-images)**: anon can SELECT; admin can INSERT/UPDATE/DELETE

## Project Environment Setup

1. Open the project in the Supabase Dashboard.
2. In **Project Settings → API**, copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
3. In **Project Settings → API Keys**, copy the **Publishable key** into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If the project only provides the legacy `anon` key, use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead; the app supports both.
4. Put the values in `.env.local` at the repository root, next to `package.json`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_WHATSAPP_PHONE=<country-code-and-number>
   ADMIN_EMAIL=<admin-email>
   ADMIN_PASSWORD=<strong-admin-password>
   ```

   Replace every `<...>` value with the real value before starting the app. Restart `pnpm dev` after changing environment variables.

`SUPABASE_SERVICE_ROLE_KEY` is not needed for the current client setup. If a server-only feature later requires it, get it from **Project Settings → API Keys** and keep it server-only: never add the `NEXT_PUBLIC_` prefix, commit it, or share it in chat.

Keep `.env.local` private and untracked. The publishable key is intended for app clients; never use a secret/service-role key as a publishable key.

Before testing data flows, confirm the Supabase database already has the tables and RLS policies the app needs. This repository does not currently include database migrations to create them.

