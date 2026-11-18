import { Pool } from 'pg'
import { readFileSync } from 'node:fs'

const DATABASE_URL = process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('Missing SUPABASE_DB_URL env var.')
  process.exit(1)
}

// Tables and functions owned by this schema — dropped with CASCADE before applying.
const DROP_STATEMENTS = [
  'drop table if exists public.order_items cascade;',
  'drop table if exists public.order_status_history cascade;',
  'drop table if exists public.coupons cascade;',
  'drop table if exists public.product_variants cascade;',
  'drop table if exists public.orders cascade;',
  'drop table if exists public.clients cascade;',
  'drop table if exists public.customers cascade;',
  'drop table if exists public.customer_credentials cascade;',
  'drop table if exists public.customer_sessions cascade;',
  'drop table if exists public.addresses cascade;',
  'drop table if exists public.profiles cascade;',
  'drop table if exists public.products cascade;',
  'drop table if exists public.settings cascade;',
  'drop function if exists public.is_admin() cascade;',
  'drop function if exists public.normalize_moroccan_phone(text) cascade;',
  'drop function if exists public.validate_coupon(text, integer) cascade;',
  'drop function if exists public.order_reference_for_tracking(text) cascade;',
  'drop function if exists public.get_order_for_tracking(text, text) cascade;',
  'drop function if exists public.place_order_rpc(uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text) cascade;',
]

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
})

async function main() {
  const migrationSql = readFileSync(
    'supabase/migrations/20261118_sais_store_schema.sql',
    'utf8'
  )
  const seedSql = readFileSync('supabase/seed.sql', 'utf8')

  const client = await pool.connect()
  try {
    await client.query('begin')

    // 1. Reset only our public tables
    for (const stmt of DROP_STATEMENTS) {
      await client.query(stmt)
    }

    // 2. Run the migration (stop on first error)
    await client.query(migrationSql)

    // 3. Run seed data
    await client.query(seedSql)

    await client.query('commit')
    console.log('DB applied successfully: migration + seed.')
  } catch (err) {
    await client.query('rollback')
    console.error('DB apply failed:', err.message)
    if (err.position) console.error('Error at position:', err.position)
    if (err.where) console.error('Context:', err.where)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
