import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAdmin() {
  const { data: admins, error: adminErr } = await supabase
    .from('profiles')
    .select('id,full_name,phone')
    .eq('role', 'admin');
  if (adminErr) throw adminErr;
  if (admins && admins.length > 0) {
    console.log('✅ Admin already exists:', admins);
    return;
  }

  const newAdmin = {
    id: crypto.randomUUID(),
    full_name: 'Site Administrator',
    phone: '+212600000001',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    city: 'Casablanca',
    address: '',
  };

  const { data, error } = await supabase.from('profiles').insert([newAdmin]);
  if (error) throw error;
  console.log('✅ Admin created:', data);
}

ensureAdmin().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
