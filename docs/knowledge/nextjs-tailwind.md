# Next.js 16 + Tailwind CSS 4

## Versions
- **next**: 16.4.5
- **react**: 19.3.1
- **typescript**: 7.0.2
- **tailwindcss**: 4.3.5
- **@tailwindcss/postcss**: 4.3.5

## Sources
- Next.js docs: https://nextjs.org/docs
- Tailwind v4 migration: https://tailwindcss.com/docs/upgrade-guide
- Next.js 16 changes: community docs (nashtechglobal.com, reddit)

## Install
```bash
pnpm create next-app@latest --typescript --tailwind --app --src-dir --eslint
# or manual:
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/react @types/react-dom
pnpm add -D tailwindcss @tailwindcss/postcss
```

## CRITICAL: Next.js 16 Breaking Changes

### 1. `middleware.ts` → `proxy.ts`
Next.js 16 renames the middleware file to `proxy.ts`. It's a network boundary, NOT a security boundary.
- Auth/authz checks MUST be duplicated in server actions and route handlers.

### 2. Caching Model Changes
- `use cache` directive and Cache Components introduced
- `revalidateTag()` may require cache life profile
- `updateTag()` for read-your-writes consistency in Server Actions
- Fetch requests and GET routes are uncached by default (since Next.js 15)

### 3. Server Actions are Public Endpoints
- Every `'use server'` function compiles to a POST endpoint
- MUST validate auth + input (Zod) in every server action
- Actions execute sequentially per client (no parallel execution)

## Key Patterns

### Server vs Client Components
- Default = Server Component (can fetch data, access DB)
- `'use client'` = Client Component (interactivity, hooks, browser APIs)
- `'use server'` = Server Action (mutations, form handling)

### Route Groups for Layout Switching
```
app/
  (storefront)/     # Customer-facing layout (Lenis, animations)
    layout.tsx
    page.tsx
    products/
  (admin)/          # Admin layout (standard, data-heavy)
    layout.tsx
    admin/
      page.tsx
```

### Metadata API
```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  return { title: '...', openGraph: { ... } }
}
```

### next/image
```tsx
<Image src={url} alt="" width={400} height={500} sizes="(max-width: 768px) 100vw, 33vw" />
```
Configure `remotePatterns` in next.config for Supabase Storage URLs.

## Tailwind CSS 4 Key Changes

### CSS-First Config (No more tailwind.config.js)
```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #1B4332;        /* Deep green */
  --color-primary-light: #2D6A4F;
  --color-background: #FFF8F0;     /* Cream/peach */
  --color-surface: #FFFFFF;        /* White cards */
  --color-text: #1A1A1A;
  --font-sans: "DM Sans", system-ui, sans-serif;
  --radius-card: 16px;             /* Rounded corners */
}
```

### PostCSS Setup
```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } }
```

### No more `content` array — automatic detection
### No more `@tailwind base/components/utilities` — just `@import "tailwindcss"`
### Renamed utilities: `shadow-sm` → `shadow-xs`, `outline-none` → `outline-hidden`
### Container queries built-in (no plugin needed)

## Important Rules

1. **`proxy.ts`** not `middleware.ts` in Next.js 16
2. Server Actions = public endpoints → always validate auth + input
3. Use route groups `(storefront)` / `(admin)` for different layouts
4. Tailwind v4 uses `@import "tailwindcss"` + `@theme {}` in CSS
5. `@tailwindcss/postcss` replaces `tailwindcss` as PostCSS plugin
6. `autoprefixer` is no longer needed (Tailwind v4 handles it)
7. Configure `remotePatterns` for Supabase Storage images
8. Use `100dvh` not `100vh` for mobile-friendly heights

## DO / DON'T

| DO | DON'T |
|---|---|
| Use `proxy.ts` for Next.js 16 | Use `middleware.ts` (deprecated) |
| Validate auth in server actions | Rely solely on proxy for security |
| Use `@import "tailwindcss"` | Use `@tailwind base/components/utilities` |
| Configure theme in CSS `@theme` | Use `tailwind.config.js` (unless legacy compat) |
| Use `'use client'` only when needed | Mark everything as client component |

