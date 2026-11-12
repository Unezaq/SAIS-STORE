// SPIKE 4: Responsive layout — BottomTabBar (mobile) / TopNav (desktop)
'use client'

import { useState } from 'react'

function TopNav() {
  return (
    <nav className="hidden md:flex items-center justify-between px-8 py-4 bg-primary text-white">
      <a href="/" className="text-xl font-bold">SAIS</a>
      <div className="flex gap-6">
        <a href="#" className="hover:opacity-80">الرئيسية</a>
        <a href="#" className="hover:opacity-80">المنتجات</a>
        <a href="#" className="hover:opacity-80">المجموعات</a>
        <a href="#" className="hover:opacity-80">حسابي</a>
      </div>
      <button className="relative">
        🛒
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">3</span>
      </button>
    </nav>
  )
}

function BottomTabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: 'home', icon: '🏠', label: 'الرئيسية' },
    { id: 'products', icon: '👗', label: 'المنتجات' },
    { id: 'collections', icon: '📁', label: 'المجموعات' },
    { id: 'cart', icon: '🛒', label: 'السلة' },
    { id: 'account', icon: '👤', label: 'حسابي' },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50"
      style={{
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex justify-around items-center h-[60px]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] ${
              activeTab === tab.id ? 'text-primary' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default function ResponsiveLayoutSpike() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="min-h-dvh bg-background">
      <TopNav />

      <main className="p-4 pb-20 md:pb-4 md:px-8 md:max-w-7xl md:mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-4">
          Spike 4: Responsive Layout
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Active tab: <strong>{activeTab}</strong> — Resize browser to see TopNav (desktop) vs BottomTabBar (mobile)
        </p>

        {/* Product grid that adapts */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl overflow-hidden shadow-xs">
              <div className="aspect-[3/4] bg-gray-200 flex items-center justify-center text-4xl">
                👗
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">فستان أنيق {i + 1}</p>
                <p className="text-primary font-bold text-sm mt-1">
                  {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(199 + i * 50)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

