import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------
// Edit these values for your admin account
const ADMIN_EMAIL = 'admin@example.com'; // <-- change to real email
const ADMIN_PASSWORD = 'SuperSecure123!'; // <-- change to strong password
const ADMIN_FULL_NAME = 'Site Administrator';
const ADMIN_PHONE = '+212600000001';
// ------------------------------------------------------------

async function createAdminUser() {
  // 1️⃣ Create auth user with app_metadata.role = 'admin'
  const { data: createResult, error: userErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (userErr) throw userErr;
  const newUserId = createResult?.user?.id;
  if (!newUserId) throw new Error('Failed to get new user ID');
  console.log('✅ Auth user created → UID:', newUserId);

  // 2️⃣ Upsert matching profile row (role = 'admin')
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .upsert([
      {
        id: newUserId,
        full_name: ADMIN_FULL_NAME,
        phone: ADMIN_PHONE,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  if (profileErr) throw profileErr;
  console.log('✅ Profile upserted →', profile);
}

createAdminUser().catch((e) => {
  console.error('❌ Error while creating admin user:', e);
  process.exit(1);
});
