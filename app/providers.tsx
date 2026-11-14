'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { SerwistProvider } from '@serwist/next/react'
import type { ReactNode } from 'react'
import { getQueryClient } from './get-query-client'

export default function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === 'development'}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SerwistProvider>
  )
}

