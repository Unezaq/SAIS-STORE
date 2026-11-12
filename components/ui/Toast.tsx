'use client'

import * as React from 'react'
import { useCallback, useState, useMemo } from 'react'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextType {
  toasts: Toast[]
  show: (type: ToastType, title: string, description?: string) => void
  dismiss: (id: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const TOAST_DURATION = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback(
    (type: ToastType, title: string, description?: string) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, type, title, description }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION)
    },
    []
  )

  const success = useCallback(
    (title: string, description?: string) => show('success', title, description),
    [show]
  )
  const error = useCallback((title: string, description?: string) => show('error', title, description), [show])
  const info = useCallback((title: string, description?: string) => show('info', title, description), [show])

  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  const value = useMemo(
    () => ({ toasts, show, dismiss, success, error, info }),
    [toasts, show, dismiss, success, error, info]
  )

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-green-600" />,
    error: <AlertCircle className="h-5 w-5 text-rose-600" />,
    info: <Info className="h-5 w-5 text-blue-600" />,
  }

  const colors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 shadow-[0_10px_30px_-10px_rgba(16,32,26,0.2)] pointer-events-auto',
              colors[t.type]
            )}
            onClick={() => dismiss(t.id)}
          >
            <div className="flex shrink-0 items-center">{icons[t.type]}</div>
            <div className="flex flex-col min-w-0">
              <p className="font-medium text-sm leading-tight">{t.title}</p>
              {t.description && <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{t.description}</p>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                dismiss(t.id)
              }}
              className="ml-2 shrink-0 opacity-0 hover:opacity-100 transition-opacity"
              aria-label="Fermer"
            >
              <span className="block h-5 w-5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 5 4 4M5 9l4-4" />
                </svg>
              </span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
