import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 1. Auto-load .env.local if not already in process.env
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Support CLI arguments: node scripts/create-admin-user.mjs <email> <password> <name> <phone>
const args = process.argv.slice(2)
const ADMIN_EMAIL = args[0] || process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@sais.ma'
const ADMIN_PASSWORD = args[1] || 'SuperSecure123!'
const ADMIN_FULL_NAME = args[2] || 'Site Administrator'
const ADMIN_PHONE = args[3] || '+212600000001'

async function createAdminUser() {
  console.log(`\nCreating / Ensuring admin user for: ${ADMIN_EMAIL}`)
  console.log(`Target project: ${new URL(supabaseUrl).host}`)

  // 1. Check if user already exists in auth
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw listError

  const existingUser = listData.users.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  )

  let userId

  if (existingUser) {
    console.log(`ℹ️ User already exists in auth (UID: ${existingUser.id}). Ensuring admin role...`)
    userId = existingUser.id

    // Update app_metadata.role = 'admin'
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { ...existingUser.app_metadata, role: 'admin' },
      email_confirm: true,
      password: args[1] ? ADMIN_PASSWORD : undefined,
    })
    if (updateError) throw updateError
  } else {
    // Create new auth user
    const { data: createResult, error: userErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    })
    if (userErr) throw userErr
    userId = createResult.user.id
    console.log('✅ Auth user created → UID:', userId)
  }

  // 2. Upsert matching profile row (role = 'admin')
  const { error: profileErr } = await supabase.from('profiles').upsert([
    {
      id: userId,
      full_name: ADMIN_FULL_NAME,
      phone: ADMIN_PHONE,
      role: 'admin',
      updated_at: new Date().toISOString(),
    },
  ])
  if (profileErr) throw profileErr
  console.log('✅ Profile upserted with role = admin')
  console.log(`\n🎉 Admin ready! You can log in at /admin/login with:`)
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}\n`)
}

createAdminUser().catch((e) => {
console.error('\n❌ Error while creating admin user:', e.message || e)
process.exit(1)
})
