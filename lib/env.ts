import { z } from 'zod'

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
})

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default('https://placeholder-project.supabase.co'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default('placeholder-anon-key'),
  NEXT_PUBLIC_WHATSAPP_PHONE: z.string().default('212600000000'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
})

export const serverEnv = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_WHATSAPP_PHONE: process.env.NEXT_PUBLIC_WHATSAPP_PHONE,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

