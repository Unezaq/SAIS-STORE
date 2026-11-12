'use client'

import 'lenis/dist/lenis.css'

import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Lenis smooth scroll, driven by GSAP's ticker so scroll, ScrollTrigger and any
 * DOM animation share one loop (per Lenis' recommended setup).
 *
 * `lerp` is used instead of `duration` — it's frame-rate independent and gives
 * the scroll its weight without an artificial settle time. Reduced motion is
 * honoured by Lenis itself; no opt-out.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null)

  useEffect(() => {
    const lenis = lenisRef.current?.lenis

    const update = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000)
    }

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    // Keep ScrollTrigger glued to Lenis' frame so scrubbed sections never lag.
    lenis?.on('scroll', ScrollTrigger.update)

    return () => {
      gsap.ticker.remove(update)
      lenis?.off('scroll', ScrollTrigger.update)
    }
  }, [])

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        autoRaf: false,
        lerp: 0.09,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
        smoothWheel: true,
        anchors: true,
        autoResize: true,
        stopInertiaOnNavigate: true,
      }}
    >
      {children}
    </ReactLenis>
  )
}
