/**
 * scripts/db-verify.mjs — Pre-flight Database Verification Tool.
 * Verifies table existence, RLS enforcement, RPC availability, and permission boundaries
 * on the Supabase project configured in .env.local.
 *
 * Usage:
 *   node scripts/db-verify.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 1. Environment Loading
function loadEnv() {
  const envPath = join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) {
      process.env[key] = val
    }
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('\n❌ Missing required environment variables in .env.local:')
  if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  if (!ANON_KEY) console.error('   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  if (!SERVICE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nPlease configure your .env.local before running verification.\n')
  process.exit(1)
}

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc = createClient(SUPABASE_URL, SERVICE_KEY)

let passed = 0
let failed = 0

function assertCheck(title, condition, extra = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: ${title} ${extra ? `(${extra})` : ''}`)
    failed++
  }
}

const canonicalTables = [
  'settings',
  'products',
  'product_variants',
  'profiles',
  'clients',
  'coupons',
  'orders',
  'order_items',
  'order_status_history',
]

const sensitiveTables = [
  'orders',
  'order_items',
  'clients',
  'coupons',
  'profiles',
  'order_status_history',
]

const canonicalRpcs = [
  { name: 'is_admin', params: {} },
  { name: 'normalize_moroccan_phone', params: { p_value: '+212600000000' } },
  { name: 'order_reference_for_tracking', params: { p_order_id: 'ord-test-123' } },
  { name: 'validate_coupon', params: { p_code: 'sais10', p_subtotal: 300 } },
  { name: 'get_order_for_tracking', params: { p_order_number: 'SAIS-00000000', p_phone: '+212600000000' } },
  { name: 'place_order_rpc', params: {} },
]

async function verify() {
  console.log('\n======================================================')
  console.log('       SAIS STORE — SUPABASE PRE-FLIGHT VERIFIER       ')
  console.log('======================================================')
  console.log(`Target Host: ${new URL(SUPABASE_URL).host}\n`)

  // 1. Table Verification
  console.log('--- 1. Table Existence Check (Canonical Schema) ---')
  for (const table of canonicalTables) {
    const { error } = await svc.from(table).select('*', { count: 'exact', head: true })
    assertCheck(`Table exists: ${table}`, !error, error?.message)
  }

  // 2. Public Read Access
  console.log('\n--- 2. Public Read Access (Storefront Active Records) ---')
  const { data: prods, error: prodErr } = await anon
    .from('products')
    .select('id, slug, is_active')
    .eq('is_active', true)
    .limit(1)
  assertCheck(
    'Anon: Active products are readable',
    !prodErr && Array.isArray(prods),
    prodErr?.message
  )

  const { data: settings, error: settErr } = await anon
    .from('settings')
    .select('store_name, currency')
    .eq('id', 1)
    .maybeSingle()
  assertCheck(
    'Anon: Store settings are readable',
    !settErr && !!settings,
    settErr?.message
  )

  // 3. Sensitive Data Protection (RLS)
  console.log('\n--- 3. RLS Data Isolation (Anon Denied) ---')
  for (const table of sensitiveTables) {
    const { data, error } = await anon.from(table).select('*').limit(1)
    const isDeniedOrEmpty = !!error || (Array.isArray(data) && data.length === 0)
    assertCheck(
      `Anon: ${table} is protected (empty or denied)`,
      isDeniedOrEmpty,
      error ? error.message : `rows returned: ${data?.length}`
    )
  }

  // 4. RPC Availability
  console.log('\n--- 4. Stored Procedures & Functions ---')
  for (const rpc of canonicalRpcs) {
    const { error } = await svc.rpc(rpc.name, rpc.params)
    const exists = !error || !/could not find the function|schema cache/i.test(error.message)
    assertCheck(`RPC registered: ${rpc.name}`, exists, error?.message)
  }

  // 5. Unauthenticated Direct Order Placement Protection
  console.log('\n--- 5. Security Boundary Verification ---')
  const { error: anonOrderError } = await anon.rpc('place_order_rpc', {
    p_auth_user_id: null,
    p_customer_id: null,
    p_client_email: null,
    p_client_name: null,
    p_customer_name: 'Attacker',
    p_phone: '+212600000000',
    p_address: 'Fake',
    p_city: 'Casablanca',
    p_items: [],
    p_note: null,
    p_coupon_code: null,
    p_idempotency_key: null,
  })
  assertCheck(
    'Anon: Direct place_order_rpc execution denied',
    !!anonOrderError,
    anonOrderError ? anonOrderError.message : 'SECURITY FAILED: unauthenticated call was permitted'
  )

  console.log('\n======================================================')
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`)
  console.log('======================================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

verify().catch((err) => {
  console.error('\n💥 Unexpected verification error:', err)
  process.exit(1)
})
