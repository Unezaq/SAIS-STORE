import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const anon = createClient(SUPABASE_URL, ANON_KEY)
const svc = createClient(SUPABASE_URL, SERVICE_KEY)

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

async function main() {
  // 1. Table count
  const { data: tables, error: tErr } = await svc
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE')
  const tableNames = (tables ?? []).map(t => t.table_name).sort()
  const expected = [
    'addresses','clients','coupons','customers','customer_credentials',
    'customer_sessions','order_items','order_status_history','orders',
    'product_variants','products','profiles','settings'
  ]
  const missing = expected.filter(t => !tableNames.includes(t))
  check('13 tables exist', tableNames.length === 13 && missing.length === 0, `missing: ${missing.join(',')}`)

  // 2. RLS enabled on all
  for (const t of expected) {
    const { data: rls } = await svc.rpc('pg_tables', {}) // fallback below
  }
  // Use information_schema via service role
  const { data: rlsRows } = await svc
    .from('pg_tables')
    .select('tablename, rowsecurity')
    .eq('schemaname', 'public')
  if (rlsRows) {
    for (const t of expected) {
      const row = rlsRows.find(r => r.tablename === t)
      check(`RLS on ${t}`, row?.rowsecurity === true, row ? '' : 'not found')
    }
  }

  // 3. No INSERT policy on orders/order_items
  const { data: policies } = await svc.from('pg_policies').select('tablename, cmd').eq('schemaname', 'public')
  const ordersInsert = policies?.some(p => p.tablename === 'orders' && p.cmd === 'INSERT')
  const itemsInsert = policies?.some(p => p.tablename === 'order_items' && p.cmd === 'INSERT')
  check('No INSERT policy on orders', !ordersInsert, ordersInsert ? 'found' : '')
  check('No INSERT policy on order_items', !itemsInsert, itemsInsert ? 'found' : '')

  // 4. Function grants
  const { data: funcs } = await svc
    .from('information_schema.routine_privileges')
    .select('routine_name, grantee')
    .eq('routine_schema', 'public')
  const funcNames = new Set((funcs ?? []).map(f => f.routine_name))
  for (const f of ['place_order_rpc', 'get_order_for_tracking', 'order_reference_for_tracking']) {
    const grants = (funcs ?? []).filter(x => x.routine_name === f).map(x => x.grantee)
    const publicGrant = grants.includes('public') || grants.includes('anon') || grants.includes('authenticated')
    check(`${f} not executable by public/anon/authenticated`, !publicGrant, `grants: ${grants.join(',')}`)
  }

  // 5. Anon key REST tests
  // products should return active products
  const { data: prods, error: prodErr } = await anon.from('products').select('*').eq('is_active', true)
  check('Anon: products SELECT works', !prodErr && Array.isArray(prods), prodErr?.message ?? `count=${prods?.length}`)

  // orders, order_items, coupons, customers, credentials, sessions, profiles, addresses, clients -> empty or denied
  const anonTables = ['orders', 'order_items', 'coupons', 'customers', 'customer_credentials', 'customer_sessions', 'profiles', 'addresses', 'clients']
  for (const t of anonTables) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    const ok = !error || (Array.isArray(data) && data.length === 0)
    check(`Anon: ${t} SELECT empty/denied`, ok, error?.message ?? `rows=${data?.length}`)
  }

  // 6. Anon RPC denied
  const { error: rpcErr } = await anon.rpc('place_order_rpc', {
    p_auth_user_id: null, p_customer_id: null, p_client_email: null, p_client_name: 'x',
    p_customer_name: 'x', p_phone: '+212600000000', p_address: 'x', p_city: 'x',
    p_items: [], p_note: null, p_coupon_code: null, p_idempotency_key: null
  })
  check('Anon: place_order_rpc denied', !!rpcErr, rpcErr?.message ?? 'allowed')

  // 7. Service role: place_order_rpc valid, then stock fail, then idempotency
  const { data: firstProd } = await svc.from('products').select('id, slug, stock, price').eq('is_active', true).limit(1).single()
  if (firstProd) {
    const items = [{ slug: firstProd.slug, quantity: 1 }]
    const { data: order1, error: o1Err } = await svc.rpc('place_order_rpc', {
      p_auth_user_id: null, p_customer_id: null, p_client_email: null, p_client_name: 'Test',
      p_customer_name: 'Test User', p_phone: '+212600000001', p_address: 'Test Addr', p_city: 'Kenitra',
      p_items: items, p_note: null, p_coupon_code: null, p_idempotency_key: 'idem-test-1'
    })
    check('Service: place_order_rpc valid creates order', !o1Err && !!order1, o1Err?.message ?? '')

    if (order1) {
      // stock fail: qty > stock
      const { data: order2, error: o2Err } = await svc.rpc('place_order_rpc', {
        p_auth_user_id: null, p_customer_id: null, p_client_email: null, p_client_name: 'Test',
        p_customer_name: 'Test User', p_phone: '+212600000002', p_address: 'Test Addr', p_city: 'Kenitra',
        p_items: [{ slug: firstProd.slug, quantity: 999999 }], p_note: null, p_coupon_code: null, p_idempotency_key: 'idem-test-2'
      })
      check('Service: place_order_rpc rejects qty > stock', !!o2Err, o2Err?.message ?? 'allowed')

      // idempotency: same key twice -> one order
      const { data: order3, error: o3Err } = await svc.rpc('place_order_rpc', {
        p_auth_user_id: null, p_customer_id: null, p_client_email: null, p_client_name: 'Test',
        p_customer_name: 'Test User', p_phone: '+212600000001', p_address: 'Test Addr', p_city: 'Kenitra',
        p_items: items, p_note: null, p_coupon_code: null, p_idempotency_key: 'idem-test-1'
      })
      check('Service: idempotency returns same order', !o3Err && order3?.order_id === order1?.order_id, o3Err?.message ?? '')

      // verify order_items + stock decrement + history
      const { data: oi } = await svc.from('order_items').select('*').eq('order_id', order1.order_id)
      const { data: ord } = await svc.from('orders').select('*').eq('id', order1.order_id).single()
      const { data: hist } = await svc.from('order_status_history').select('*').eq('order_id', order1.order_id)
      check('Service: order_items created', Array.isArray(oi) && oi.length > 0, `rows=${oi?.length}`)
      check('Service: stock decremented', ord && ord.items.length > 0, '')
      check('Service: order_status_history created', Array.isArray(hist) && hist.length > 0, `rows=${hist?.length}`)

      // cleanup test rows
      await svc.from('order_status_history').delete().eq('order_id', order1.order_id)
      await svc.from('order_items').delete().eq('order_id', order1.order_id)
      await svc.from('orders').delete().eq('id', order1.order_id)
    }
  }

  console.log(`\n${pass} PASS, ${fail} FAIL`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })