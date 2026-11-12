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

