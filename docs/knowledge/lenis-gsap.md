# Lenis + GSAP ScrollTrigger

## Versions
- **lenis**: 1.3.27
- **gsap**: 3.15.1
- **@gsap/react**: 2.1.2

## Sources
- Lenis GitHub: https://github.com/darkroomengineering/lenis
- Lenis npm: https://www.npmjs.com/package/lenis
- GSAP React: https://gsap.com/resources/React/
- GSAP license: Free for all standard use (acquired by Webflow, all plugins now free)

## Install
```bash
pnpm add lenis gsap @gsap/react
```

## Key Integration Pattern (Verified)
The single most critical pattern: **share one RAF clock between Lenis and GSAP**.

```tsx
'use client'
import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null)

  useEffect(() => {
    const update = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000)
    }
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(update) }
  }, [])

  return (
    <ReactLenis ref={lenisRef} root options={{ autoRaf: false }}>
      {children}
    </ReactLenis>
  )
}
```

## Important Rules

1. **Set `autoRaf: false`** on ReactLenis when syncing with GSAP. Otherwise two RAF loops cause jitter.
2. **Set `gsap.ticker.lagSmoothing(0)`** to prevent rubber-banding during heavy loads.
3. **Connect scroll events**: `lenis.on('scroll', ScrollTrigger.update)` (already handled when using unified ticker).
4. **Use `useGSAP` hook** from `@gsap/react` instead of `useEffect` for animations — it auto-cleans ScrollTrigger instances on unmount.
5. **Always pass `{ scope: containerRef }`** to `useGSAP` to confine selector scope.
6. **Call `ScrollTrigger.refresh()`** after dynamic content loads (images, lazy components).
7. **Modals/sheets**: Call `lenis.stop()` on open, `lenis.start()` on close.
8. **`data-lenis-prevent`** attribute on elements that need native scroll (textareas, modals, bottom sheets).
9. **Route changes**: Lenis with `root` prop handles cleanup. For hash links, use `lenis.scrollTo('#hash')`.
10. **Reduced motion**: Lenis respects `prefers-reduced-motion` by default.

## DO / DON'T

| DO | DON'T |
|---|---|
| Use `'use client'` for all animated components | Import GSAP in server components |
| Register plugins once: `gsap.registerPlugin(ScrollTrigger)` | Register per component |
| Use `useGSAP` with `scope` | Use raw `useEffect` + manual cleanup |
| `autoRaf: false` + GSAP ticker | Leave both RAF loops running |
| `ScrollTrigger.refresh()` after layout changes | Assume scroll height is static |
| `lenis.stop()` / `lenis.start()` for overlays | Ignore scroll lock in modals |

## Project Fit
- Storefront pages use Lenis for smooth scroll feel
- GSAP ScrollTrigger for product reveal animations, pinned hero sections
- Admin dashboard does NOT use Lenis (standard scroll for data-heavy UI)
- Mobile: test `touchMultiplier` option for natural feel on iOS/Android
- Bottom sheets need `data-lenis-prevent` to allow internal scrolling

