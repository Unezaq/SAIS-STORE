# Motion (ex Framer Motion), TanStack Query, Zod, React Hook Form

## Versions
- **motion** (was framer-motion): 14.11.1 — import from `motion/react`
- **@tanstack/react-query**: 5.107.1
- **zod**: 4.6.7 (v4 — major rewrite from v3)
- **react-hook-form**: 7.91.0
- **@hookform/resolvers**: 7.0.5

## Sources
- Motion migration: https://github.com/motiondivision/motion (formerly framer-motion)
- Motion docs: https://motion.dev
- TanStack Query SSR: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- Zod v4: https://zod.dev
- React Hook Form: https://react-hook-form.com

## Install
```bash
pnpm add motion @tanstack/react-query zod react-hook-form @hookform/resolvers
pnpm add -D @tanstack/react-query-devtools
```

## Motion (was framer-motion)

### CRITICAL: Package renamed
```tsx
// ❌ OLD
import { motion, AnimatePresence } from 'framer-motion'
// ✅ NEW
import { motion, AnimatePresence } from 'motion/react'
```

### Key APIs for this project
- `<motion.div>` — animated elements (product cards, page transitions)
- `<AnimatePresence>` — exit animations (modals, page transitions)
- `useScroll` + `useTransform` — scroll-linked animations
- `drag` prop — bottom sheet gesture dismissal
- `layout` prop — shared layout animations (product grid ↔ detail)
- Variants + staggerChildren — product grid reveal

### Rules
1. All motion components need `'use client'`
2. Don't install both `framer-motion` AND `motion` — causes context bugs
3. v13+ removed `@emotion/is-prop-valid` — if using styled-components, add `MotionConfig isValidProp`
4. For bottom sheets: use `drag="y"` + `dragConstraints` + `onDragEnd` with velocity check

## TanStack Query v5

### Setup Pattern (Server + Client)
```ts
// app/get-query-client.ts
import { QueryClient, isServer } from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 }, // 60s to prevent refetch after hydration
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
```

### Server Prefetch + Hydration
```tsx
// Server Component
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/app/get-query-client'

export default async function Page() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: ['products'], queryFn: fetchProducts })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductList /> {/* Client component uses useQuery */}
    </HydrationBoundary>
  )
}
```

### Rules
1. Never share QueryClient across requests on server
2. Set `staleTime > 0` to prevent immediate refetch after hydration
3. Use `useMutation` + `onSuccess: () => queryClient.invalidateQueries()` for cart ops
4. `useInfiniteQuery` for paginated product lists

## Zod v4

### Key Changes from v3
1. **Error param**: `{ error: 'message' }` replaces `{ message: 'message' }`
2. **Top-level validators**: `z.email()`, `z.uuid()`, `z.url()` (tree-shakeable)
3. **Error helpers**: `z.flattenError(err)`, `z.prettifyError(err)` replace instance methods
4. **Object strictness**: `z.strictObject({})` replaces `.strict()` chain
5. **Requires TypeScript 5.5+**
6. **`zod/mini`** for smaller bundles on client

### Example Schema
```ts
const productSchema = z.object({
  name: z.string().min(1, { error: 'Product name required' }),
  price: z.number().positive({ error: 'Price must be positive' }),
  description: z.string().optional(),
  category_id: z.string().uuid(),
})
```

## React Hook Form + Zod Integration

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ name: z.string().min(1), price: z.coerce.number().positive() })
type FormData = z.infer<typeof schema>

function ProductForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  // ...
}
```

### Rules
1. `@hookform/resolvers` v5+ required for Zod v4 (we have v7.0.5 ✓)
2. Use `z.coerce.number()` for HTML number inputs
3. For file uploads, use controlled fields with `setValue`
4. For nested product variants, use `useFieldArray`

## DO / DON'T

| DO | DON'T |
|---|---|
| Import from `motion/react` | Import from `framer-motion` |
| Use `z.email()` top-level (v4) | Use `z.string().email()` (v3 style — deprecated) |
| Set `staleTime > 0` with SSR | Leave default staleTime of 0 |
| Use `HydrationBoundary` (v5) | Use `Hydrate` (v4 — removed) |
| Use `zodResolver` from `@hookform/resolvers/zod` | Write manual validation |

