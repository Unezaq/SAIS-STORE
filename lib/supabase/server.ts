import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client côté serveur (Server Components, Server Actions).
 * Si les variables d'environnement Supabase ne sont pas configurées, retourne
 * un mock client qui renvoie des données vides — le site tourne en dev sans
 * base de données configurée.
 */
export function createClient() {
  const cookieStore = cookies() as any

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const isConfigured =
    url &&
    key &&
    !url.includes('placeholder') &&
    !key.includes('placeholder') &&
    url.startsWith('http')

  if (!isConfigured) {
    // Mock client : toutes les requêtes renvoient des données vides
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            not: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
            order: () => Promise.resolve({ data: [], error: null }),
            single: () => Promise.resolve({ data: null, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        upsert: () => Promise.resolve({ error: null }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    } as any
  }

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options })
      },
    },
  })
}
