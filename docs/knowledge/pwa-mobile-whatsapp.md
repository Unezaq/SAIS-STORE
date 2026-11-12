# PWA, Mobile UX, and WhatsApp Integration

## Versions
- **@serwist/next**: 9.5.13 (replaces @ducanh2912/next-pwa and next-pwa)
- **serwist**: 9.5.13

## Sources
- Serwist docs: https://serwist.pages.dev/docs/next
- WhatsApp Click-to-Chat: https://faq.whatsapp.com/5913398998672934
- MDN safe-area: https://developer.mozilla.org/en-US/docs/Web/CSS/env
- MDN dvh: https://developer.mozilla.org/en-US/docs/Web/CSS/length#dvh

## Install
```bash
pnpm add @serwist/next
pnpm add -D serwist
```

---

## PWA Setup with Serwist (Verified)

### Service Worker (`app/sw.ts`)
```ts
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}
declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})
serwist.addEventListeners()
```

### Next.js Config
```ts
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})
export default withSerwist(nextConfig)
```

### Manifest (`app/manifest.ts`)
```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SAIS Store',
    short_name: 'SAIS',
    description: 'Women\'s fashion store',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8F0',
    theme_color: '#1B4332',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

### .gitignore additions
```
public/sw*
public/swe-worker*
```

### Offline page: `app/~offline/page.tsx`

---

## Mobile-App-Like UX

### Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### Full-Height Layout
```css
html, body { height: 100dvh; overflow: hidden; }
.app-container { display: flex; flex-direction: column; height: 100dvh; }
```

### Bottom Tab Bar
```css
.bottom-tab-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: calc(60px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  backdrop-filter: blur(10px);
  z-index: 1000;
}
```

### Bottom Sheet (Framer Motion drag)
```tsx
<motion.div
  drag="y"
  dragConstraints={{ top: 0 }}
  dragElastic={0.1}
  onDragEnd={(_, info) => {
    if (info.velocity.y > 500 || info.offset.y > 200) onClose()
  }}
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
```

### Key CSS Properties
```css
/* Prevent pull-to-refresh conflicts */
body { overscroll-behavior: none; }

/* Remove tap highlight */
* { -webkit-tap-highlight-color: transparent; }

/* Touch targets minimum 48px */
.tab-item { min-height: 48px; min-width: 48px; }

/* Detect standalone mode */
@media (display-mode: standalone) { /* PWA-specific styles */ }
```

---

## WhatsApp Integration

### URL Format
```
https://wa.me/212XXXXXXXXX?text=ENCODED_MESSAGE
```

### Rules
1. **Phone number**: International format, no `+`, no spaces, no dashes. Morocco = `212...`
2. **Message encoding**: Use `encodeURIComponent()` for Arabic/French text
3. **Newlines**: `%0A` in encoded text
4. **Practical message limit**: ~400-500 Arabic chars (URL length limit ~2048 chars, Arabic chars = 2 bytes each → 6 chars per letter when URL-encoded)
5. **Behavior**: Mobile → opens WhatsApp app; Desktop → opens WhatsApp Web

### Order Message Template
```ts
function buildWhatsAppUrl(order: Order, phone: string): string {
  const lines = [
    `🛒 طلب جديد #${order.id}`,
    `👤 ${order.customerName}`,
    `📱 ${order.customerPhone}`,
    `📍 ${order.address}`,
    '',
    '📦 المنتجات:',
    ...order.items.map(item =>
      `• ${item.name} (${item.variant}) × ${item.quantity} = ${item.price} MAD`
    ),
    '',
    `💰 المجموع: ${order.total} MAD`,
    `💳 الدفع عند الاستلام`,
  ]
  const message = encodeURIComponent(lines.join('\n'))
  return `https://wa.me/${phone}?text=${message}`
}
```

---

## iOS PWA Limitations (as of 2026)
1. Push notifications: Partially supported (iOS 16.4+ Safari, requires user interaction)
2. No background sync
3. Splash screen: Auto-generated from manifest, limited customization
4. No badge API support
5. `100dvh` may short-change by safe area in standalone mode — use workaround:
   ```css
   .app-container { height: calc(100dvh + env(safe-area-inset-bottom)); }
   ```

## Important Rules

1. Use `@serwist/next` (not `next-pwa` or `@ducanh2912/next-pwa` — both deprecated)
2. Disable service worker in development (`disable: process.env.NODE_ENV === 'development'`)
3. Always use `viewport-fit=cover` + `env(safe-area-inset-*)` for edge-to-edge
4. Use `100dvh` not `100vh` for mobile
5. Touch targets minimum 48×48px
6. `overscroll-behavior: none` on body to prevent pull-to-refresh conflicts
7. Keep WhatsApp messages under 400 Arabic characters
8. Always `encodeURIComponent()` the message text
9. Test PWA install flow on both Android Chrome and iOS Safari
10. Bottom tab bar visible on mobile only; top nav on desktop

