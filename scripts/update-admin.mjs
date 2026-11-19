import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fixAdmin() {
  const { data: admins, error: err } = await supabase
    .from('profiles')
    .select('id,full_name,phone')
    .eq('role', 'admin');
  if (err) throw err;
  if (!admins || admins.length === 0) {
    console.log('No admin found to update.');
    return;
  }
  const admin = admins[0];
  const updates = {};
  if (!admin.full_name) updates.full_name = 'Site Administrator';
  if (!admin.phone) updates.phone = '+212600000001';
  if (Object.keys(updates).length === 0) {
    console.log('Admin already has proper data:', admin);
    return;
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', admin.id);
  if (error) throw error;
  console.log('✅ Admin updated:', data);
}

fixAdmin().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
