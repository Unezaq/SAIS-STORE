
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ============================================
// 1. Load environment variables
// ============================================

function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')

    for (const line of content.split('\n')) {
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith('#')) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue

      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()

      if (key && !process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, '')
      }
    }
  } catch (error) {
    console.error(`Could not load ${filePath}:`, error.message)
  }
}

loadEnv('.env.local')

// ============================================
// 2. Supabase configuration
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('FAIL: Missing Supabase environment variables.')
  process.exit(1)
}

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc = createClient(SUPABASE_URL, SERVICE_KEY)

// ============================================
// 3. Test helpers
// ============================================

let pass = 0
let fail = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS: ${name}`)
    pass++
  } else {
    console.log(`FAIL: ${name} ${detail}`)
    fail++
  }
}

const expectedTables = [
  'addresses',
  'clients',
  'coupons',
  'customers',
  'customer_credentials',
  'customer_sessions',
  'order_items',
  'order_status_history',
  'orders',
  'product_variants',
  'products',
  'profiles',
  'settings'
]

const protectedTables = [
  'orders',
  'order_items',
  'coupons',
  'customers',
  'customer_credentials',
  'customer_sessions',
  'profiles',
  'addresses',
  'clients'
]

// ============================================
// 4. Main verification
// ============================================

async function main() {
  console.log('\n========== SAIS STORE DB VERIFY ==========\n')

  // ------------------------------------------
  // A. Verify tables through Supabase REST
  // ------------------------------------------

  for (const table of expectedTables) {
    const { error } = await svc
      .from(table)
      .select('*', { head: true, count: 'exact' })
      .limit(0)

    check(
      `Table exists: ${table}`,
      !error,
      error?.message ?? ''
    )
  }

  // ------------------------------------------
  // B. Verify RLS through direct access
  // Note: PostgREST does not expose pg_tables
  // ------------------------------------------

  console.log('\n--- RLS / Policies ---')

  const { data: policies, error: policyError } = await svc
    .from('pg_policies')
    .select('tablename, cmd')
    .eq('schemaname', 'public')

  if (policyError) {
    console.log(
      'SKIP: Policies inspection unavailable through REST:',
      policyError.message
    )
  } else {
    for (const table of ['orders', 'order_items']) {
      const hasInsert = policies.some(
        p => p.tablename === table && p.cmd === 'INSERT'
      )

      check(
        `No INSERT policy on ${table}`,
        !hasInsert
      )
    }
  }

  // ------------------------------------------
  // C. Anon access tests
  // ------------------------------------------

  console.log('\n--- Anon access ---')

  const { data: products, error: productsError } = await anon
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)

  check(
    'Anon: products SELECT works',
    !productsError && Array.isArray(products),
    productsError?.message ?? ''
  )

  for (const table of protectedTables) {
    const { data, error } = await anon
      .from(table)
      .select('*')
      .limit(1)

    const deniedOrEmpty =
      !!error || (Array.isArray(data) && data.length === 0)

    check(
      `Anon: ${table} SELECT empty/denied`,
      deniedOrEmpty,
      error?.message ?? `rows=${data?.length}`
    )
  }

  // ------------------------------------------
  // D. Verify RPC availability
  // ------------------------------------------

  console.log('\n--- RPC functions ---')

  const rpcNames = [
    'place_order_rpc',
    'validate_coupon',
    'get_order_for_tracking',
    'order_reference_for_tracking',
    'normalize_moroccan_phone',
    'is_admin'
  ]

  // RPC existence cannot be reliably inspected through
  // the Supabase REST interface without calling it.
  // We use a harmless invalid-arguments call for discovery.

  for (const rpcName of rpcNames) {
    const { error } = await svc.rpc(rpcName, {})

    const exists =
      !error ||
      !/could not find the function|schema cache/i.test(error.message)

    check(
      `RPC available: ${rpcName}`,
      exists,
      error?.message ?? ''
    )
  }

  // ------------------------------------------
  // E. Verify place_order_rpc is not accessible
  // to anonymous users
  // ------------------------------------------

  console.log('\n--- Anonymous RPC security ---')

  const { error: anonRpcError } = await anon.rpc(
    'place_order_rpc',
    {
      p_auth_user_id: null,
      p_customer_id: null,
      p_client_email: null,
      p_client_name: 'Test',
      p_customer_name: 'Test',
      p_phone: '+212600000000',
      p_address: 'Test',
      p_city: 'Kenitra',
      p_items: [],
      p_note: null,
      p_coupon_code: null,
      p_idempotency_key: null
    }
  )

  check(
    'Anon: place_order_rpc denied',
    !!anonRpcError,
    anonRpcError?.message ?? 'RPC unexpectedly allowed'
  )

  // ------------------------------------------
  // F. Final result
  // ------------------------------------------

  console.log('\n==========================================')
  console.log(`${pass} PASS, ${fail} FAIL`)
  console.log('==========================================\n')

  process.exitCode = fail > 0 ? 1 : 0
}

main().catch(error => {
  console.error('\nFATAL ERROR:', error)
  process.exitCode = 1
})
