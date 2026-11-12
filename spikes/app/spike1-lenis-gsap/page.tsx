// SPIKE 1: Lenis + GSAP ScrollTrigger
// Tests: smooth scroll, pinned section, data-lenis-prevent modal
'use client'

import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
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

function PinnedSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.to(pinnedRef.current, {
      scrollTrigger: {
        trigger: pinnedRef.current,
        start: 'top top',
        end: '+=300%',
        pin: true,
        scrub: 1,
        markers: true,
      },
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <div ref={pinnedRef} className="h-screen bg-primary flex items-center justify-center">
        <h2 className="text-4xl font-bold text-white">📌 Pinned Section</h2>
      </div>
    </div>
  )
}

function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div
        data-lenis-prevent
        className="bg-surface rounded-2xl p-6 w-80 max-h-96 overflow-y-auto"
      >
        <h3 className="text-xl font-bold mb-4">Modal with data-lenis-prevent</h3>
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="mb-2 text-sm">Scrollable content line {i + 1}. This should scroll natively inside the modal without Lenis intercepting.</p>
        ))}
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg">Close</button>
      </div>
    </div>
  )
}

export default function LenisGsapSpike() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <SmoothScrollProvider>
      <section className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Spike 1: Lenis + GSAP</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 bg-primary text-white rounded-xl"
          >
            Open Modal (data-lenis-prevent test)
          </button>
        </div>
      </section>

      <PinnedSection />

      <section className="h-screen bg-primary-light flex items-center justify-center">
        <h2 className="text-3xl text-white">After Pinned Section</h2>
      </section>

      <section className="h-screen bg-background flex items-center justify-center">
        <h2 className="text-3xl text-primary">End of Page</h2>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SmoothScrollProvider>
  )
}

