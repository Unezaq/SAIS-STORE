# AGENTS.md — SAIS Store Project Rules

> Women's clothing online store. PWA. Morocco-focused.

## Tech Stack (Exact Versions — November 2026)
| Package | Version | Notes |
|---------|---------|-------|
| next | 16.4.5 | App Router, `proxy.ts` replaces `middleware.ts` |
| react | 19.3.1 | |
| typescript | 7.0.2 | |
| tailwindcss | 4.3.5 | CSS-first config with `@theme` |
| @supabase/supabase-js | 2.119.0 | |
| @supabase/ssr | 0.12.7 | |
| lenis | 1.3.27 | Smooth scroll, `autoRaf: false` with GSAP |
| gsap | 3.15.1 | Free license (Webflow acquisition) |
| @gsap/react | 2.1.2 | `useGSAP` hook |
| motion | 14.11.1 | Was `framer-motion`, import from `motion/react` |
| @tanstack/react-query | 5.107.1 | |
| zod | 4.6.7 | v4 rewrite — use `z.email()` not `z.string().email()` |
| react-hook-form | 7.91.0 | |
| @hookform/resolvers | 7.0.5 | |
| @serwist/next | 9.5.13 | PWA service worker |

## Project Conventions

### File Naming
- Components: `PascalCase.tsx`
- Utilities/hooks: `camelCase.ts`
- Constants: `SCREAMING_SNAKE_CASE`
- Route files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`

### Import Order
1. React / Next.js
2. Third-party libraries
3. Internal components (`@/components/`)
4. Internal utilities (`@/lib/`, `@/utils/`)
5. Types (`@/types/`)
6. Styles

### Component Rules
- Server Components by default. Add `'use client'` only when needed.
- Every `'use server'` action MUST validate auth + input with Zod.
- All animated components are Client Components.
- Admin components never use Lenis smooth scroll.

### Styling
- Tailwind v4 CSS-first config in `app/globals.css`
- Design tokens in `@theme {}` block
- Primary: deep green `#1B4332`
- Background: cream/peach `#FFF8F0`
- Cards: white `#FFFFFF` with rounded corners
- Font: DM Sans

### Data Flow
- TanStack Query for all client-side data fetching
- Prefetch in Server Components → HydrationBoundary
- Mutations via Server Actions (validated with Zod)
- Prices ALWAYS recalculated server-side

### Currency & Locale
- Currency: MAD (Moroccan Dirham)
- Format: `new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`
- Phone: Moroccan format (+212...)
- UI text: French primarily, Arabic support

## Folder Structure
```
f:\sais - store\
├── app/
│   ├── (storefront)/          # Customer-facing pages
│   │   ├── layout.tsx         # Lenis + animations layout
│   │   ├── page.tsx           # Home
│   │   ├── products/
│   │   ├── collections/
│   │   ├── cart/
│   │   └── checkout/
│   ├── (admin)/               # Admin dashboard
│   │   ├── layout.tsx         # Standard layout, no Lenis
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── products/
│   │       ├── orders/
│   │       ├── collections/
│   │       └── settings/
│   ├── (auth)/                # Auth pages
│   │   ├── login/
│   │   └── register/
│   ├── api/                   # Route handlers (if needed)
│   ├── manifest.ts
│   ├── sw.ts
│   ├── layout.tsx             # Root layout
│   ├── globals.css
│   ├── providers.tsx
│   └── get-query-client.ts
├── components/
│   ├── ui/                    # Shared UI primitives
│   ├── storefront/            # Customer-facing components
│   ├── admin/                 # Admin-specific components
│   └── layout/                # Layout components (nav, tabs, etc.)
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── whatsapp.ts
│   └── utils.ts
├── hooks/
├── types/
│   └── supabase.ts            # Generated types
├── actions/                   # Server actions
├── schemas/                   # Zod schemas
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── public/
│   ├── icons/
│   └── images/
├── docs/
│   └── knowledge/             # ← You are here
├── proxy.ts                   # Next.js 16 (was middleware.ts)
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── AGENTS.md                  # ← This file
```

## Knowledge Base
See `docs/knowledge/` for detailed cheat sheets:
- [lenis-gsap.md](docs/knowledge/lenis-gsap.md) — Smooth scroll + animations
- [supabase.md](docs/knowledge/supabase.md) — Auth, DB, Storage, RLS
- [nextjs-tailwind.md](docs/knowledge/nextjs-tailwind.md) — Next.js 16 + Tailwind 4
- [motion-forms-query.md](docs/knowledge/motion-forms-query.md) — Motion, TanStack Query, Zod v4, RHF
- [pwa-mobile-whatsapp.md](docs/knowledge/pwa-mobile-whatsapp.md) — PWA, mobile UX, WhatsApp

## Commands
```bash
pnpm dev                                # Development server (Webpack, Serwist off)
pnpm build                              # Production build (Webpack — Serwist requires it)
pnpm start                              # Production server
pnpm test                               # Vitest suite (vitest run)
pnpm exec vitest run                    # same, if npx is blocked by devEngines
pnpm db:seed-products -- --confirm      # Upsert catalogue from data/store.json
```

There is **no** `lint`, `db:gen`, `db:push` or `db:reset` script. `eslint` cannot run on
TypeScript 7.0 (typescript-eslint refuses it), so `pnpm build` is the type check. Migrations in
`supabase/migrations/` are applied manually in the Supabase SQL Editor; never edit an applied
migration — add a new dated file instead.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
