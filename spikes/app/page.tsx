import Link from 'next/link'

export default function SpikesHome() {
  const spikes = [
    { href: '/spike1-lenis-gsap', title: 'Spike 1: Lenis + GSAP ScrollTrigger', desc: 'Smooth scroll, pinned section, data-lenis-prevent modal' },
    { href: '/spike3-whatsapp', title: 'Spike 3: WhatsApp Link', desc: 'Arabic/French prefilled wa.me message' },
    { href: '/spike4-layout', title: 'Spike 4: Responsive Layout', desc: 'BottomTabBar (mobile) / TopNav (desktop)' },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">SAIS Store — Spike Experiments</h1>
      <div className="grid gap-4 max-w-xl">
        {spikes.map(spike => (
          <Link
            key={spike.href}
            href={spike.href}
            className="block bg-surface p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow"
          >
            <h2 className="text-lg font-bold text-primary">{spike.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{spike.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

