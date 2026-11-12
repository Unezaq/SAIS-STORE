// SPIKE 3: WhatsApp wa.me link with Arabic/French multi-line message
'use client'

import { useState } from 'react'

function buildWhatsAppUrl(phone: string, order: {
  id: string
  customerName: string
  customerPhone: string
  address: string
  items: { name: string; variant: string; quantity: number; price: number }[]
  total: number
}): string {
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
    '',
    `--- Commande #${order.id} ---`,
    `Paiement à la livraison`,
  ]
  const message = encodeURIComponent(lines.join('\n'))
  return `https://wa.me/${phone}?text=${message}`
}

export default function WhatsAppSpike() {
  const [url, setUrl] = useState('')

  const testOrder = {
    id: 'ORD-001',
    customerName: 'فاطمة الزهراء',
    customerPhone: '+212 6XX XXX XXX',
    address: 'الدار البيضاء، المغرب',
    items: [
      { name: 'فستان صيفي', variant: 'M / أخضر', quantity: 1, price: 299 },
      { name: 'حقيبة يد', variant: 'بيج', quantity: 1, price: 199 },
    ],
    total: 498,
  }

  const storePhone = '212600000000' // Replace with real number

  const handleGenerate = () => {
    const link = buildWhatsAppUrl(storePhone, testOrder)
    setUrl(link)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-6">Spike 3: WhatsApp Link</h1>

      <button
        onClick={handleGenerate}
        className="px-6 py-3 bg-primary text-white rounded-xl mb-6"
      >
        Generate WhatsApp Link
      </button>

      {url && (
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-xl">
            <h2 className="font-bold mb-2">Generated URL:</h2>
            <p className="text-xs break-all font-mono">{url}</p>
            <p className="text-sm mt-2 text-gray-600">URL length: {url.length} chars</p>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-xl"
          >
            📱 Open in WhatsApp
          </a>

          <div className="bg-surface p-4 rounded-xl">
            <h2 className="font-bold mb-2">Decoded Preview:</h2>
            <pre className="whitespace-pre-wrap text-sm direction-rtl text-right">
              {decodeURIComponent(url.split('?text=')[1] || '')}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

