# SAIS STORE — Folder Structure & Module Organization

**Version:** 2.0  
**Updated:** November 21, 2026

---

## 1. Directory Tree Overview

```
f:\sais - store\
├── actions/                         # Next.js Server Actions
│   ├── admin.ts                     # Admin mutations (product, order status, coupon, settings)
│   └── checkout.ts                  # Public checkout & order tracking mutations
│
├── app/                             # Next.js App Router root
│   ├── (admin)/                     # Admin Dashboard route group (protected)
│   │   ├── admin/
│   │   │   ├── clients/page.tsx     # Client CRM directory
│   │   │   ├── coupons/             # Coupon management (list, new, edit)
│   │   │   ├── orders/              # Order management (list, detail, status update)
│   │   │   ├── products/            # Product catalog management (list, new, edit)
│   │   │   ├── settings/page.tsx    # Store configuration (delivery fees, promos)
│   │   │   └── page.tsx             # Executive overview dashboard
│   │   ├── layout.tsx               # Admin layout (no Lenis, sidebar, requireAdmin)
│   │   └── loading.tsx              # Admin route loading skeleton
│   │
│   ├── (auth)/                      # Authentication route group
│   │   └── admin/login/page.tsx     # Admin credentials login
│   │
│   ├── (storefront)/                # Customer-facing storefront route group
│   │   ├── boutique/page.tsx        # Product catalog with category rail
│   │   ├── checkout/page.tsx        # Two-step COD checkout form
│   │   ├── collections/             # Category collections overview and detail
│   │   ├── espace-client/page.tsx   # Customer assistance, FAQ, WhatsApp link
│   │   ├── products/[slug]/page.tsx # Product details, variants, gallery, story
│   │   ├── promotions/page.tsx      # Sale items / discounted pieces
│   │   ├── suivre/                  # Public order tracking (by phone or by token)
│   │   ├── wishlist/page.tsx        # Saved favorites (client-side localStorage)
│   │   ├── layout.tsx               # Storefront layout (Lenis smooth scroll, nav, footer)
│   │   └── page.tsx                 # Homepage (hero, story, categories, features)
│   │
│   ├── api/                         # System route handlers
│   │   └── ping/route.ts            # Sitemap discovery endpoint
│   ├── auth/callback/route.ts       # Auth session code exchange & admin bootstrap
│   ├── globals.css                  # Tailwind CSS v4 @theme design tokens
│   ├── layout.tsx                   # Root HTML layout & font definitions
│   ├── providers.tsx                # Client-side providers (QueryClient, CartProvider)
│   └── proxy.ts                     # Next.js 16 Edge proxy (replaces middleware.ts)
│
├── components/                      # Reusable UI components
│   ├── admin/                       # Admin-specific components (forms, tables, buttons)
│   ├── layout/                      # Navigation, footer, adaptive tabs, page transitions
│   ├── storefront/                  # Customer-facing components (cards, gallery, cart)
│   └── ui/                          # Design primitives (Button, Input, Badge, Toast, Sheet)
│
├── data/                            # Static catalog seed data
│   └── store.json                   # Product catalog definition (16 Moroccan garments)
│
├── docs/                            # Production documentation
│   ├── architecture/                # Architecture, Folder Structure, Data Flow
│   ├── database/                    # ERD, Database Schema, Migrations guide
│   ├── security/                    # Threat model & RLS security specification
│   └── audit/                       # Complete repository audit and cleanup record
│
├── lib/                             # Core application library
│   ├── db/                          # Database connection clients
│   │   ├── client.ts                # Browser Supabase client (@supabase/ssr)
│   │   ├── server.ts                # Server Supabase client with Next.js cookies
│   │   └── admin.ts                 # Privileged service_role client (server-only)
│   │
│   ├── services/                    # Business Domain Services
│   │   ├── products.service.ts      # Product queries, category filtering, catalog admin
│   │   ├── orders.service.ts        # Order creation (RPC), status transitions, tracking
│   │   ├── clients.service.ts       # CRM client directory & stats aggregation
│   │   ├── coupons.service.ts       # Coupon validation RPC & admin coupon CRUD
│   │   └── settings.service.ts      # Singleton store settings & storewide promo logic
│   │
│   ├── security/                    # Security utilities
│   │   ├── auth.ts                  # requireAdmin, getAuthenticatedUser helpers
│   │   └── rateLimit.ts             # In-memory IP/phone rate limiter
│   │
│   ├── types/                       # TypeScript domain interfaces
│   │   └── store.ts                 # StoreOrder, StoreProduct, StoreClient, StoreCoupon
│   │
│   ├── data.ts                      # Product & Category static models & discount percent
│   ├── pricing.ts                   # Authoritative price calculation engine
│   ├── phone.ts                     # Moroccan phone normalization & formatting
│   ├── orderStatus.ts               # Order status definitions, steps & reference generator
│   ├── products.ts                  # Storefront data facade
│   ├── store.ts                     # Legacy store facade delegating to services
│   ├── utils.ts                     # Formatting (MAD currency, class merging)
│   └── env.ts                       # Environment variable validation via Zod
│
├── scripts/                         # Operational & maintenance CLI tools
│   ├── seed-products.mjs            # Catalog upsert into Supabase
│   ├── create-admin-user.mjs        # Admin user creation script
│   └── db-verify.mjs                # Pre-flight connection & schema verification tool
│
├── supabase/                        # Database migrations & seeds
│   ├── migrations/                  # Active migrations
│   │   └── 20261122_sais_store_production.sql  # Consolidated canonical schema
│   ├── archive/                     # Immutable archive of historical migrations
│   │   └── legacy_migrations/       # Preserved historical SQL scripts
│   └── seed.sql                     # Baseline seed for clean project initialization
│
├── tests/                           # Automated Vitest test suite
│   ├── lib/supabase-mock.ts         # In-memory Supabase mock
│   ├── orders/order-creation.test.ts# Order creation & RPC unit tests
│   ├── store/settings.test.ts       # Settings query unit tests
│   └── setup.ts                     # Test setup and mocks
│
├── .env.example                     # Environment template with placeholder values
├── package.json                     # Project manifest and scripts
├── proxy.ts                         # Next.js 16 proxy
├── next.config.ts                   # Next.js 16 configuration (Webpack, Serwist)
└── tsconfig.json                    # TypeScript 7.0 compiler options
```

---

## 2. Dependency Flow Rules

1. **Unidirectional Flow:**
   `UI Components → Server Actions → Domain Services → Supabase Clients → PostgreSQL`
2. **Server-Only Enforcement:**
   `lib/db/admin.ts`, `lib/services/*`, and `lib/security/auth.ts` enforce `import 'server-only'` to guarantee that privileged database operations and keys can never leak into client JavaScript bundles.
3. **No Direct Database Access in UI:**
   Components inside `app/` and `components/` never query Supabase directly; they always interact through domain services or Server Actions.
