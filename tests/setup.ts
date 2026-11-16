import { beforeEach, afterEach, vi } from 'vitest'

// Mock 'server-only' so Server Action modules can be imported in tests
vi.mock('server-only', () => ({}))

// Mock next/cache for revalidatePath in server actions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(() => {}),
  revalidateTag: vi.fn(() => {}),
}))

// Mock next/navigation for redirect in server actions
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

// Mock next/headers cookies for server client in tests
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: () => undefined,
    getAll: () => [],
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

// Mock environment variables for tests
// @ts-expect-error - NODE_ENV is read-only but we need to set it for tests
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

const originalError = console.error
const originalWarn = console.warn

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  console.error = originalError
  console.warn = originalWarn
})
