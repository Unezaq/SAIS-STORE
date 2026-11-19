import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
  const { data: prods } = await supabase.from('products').select('slug').limit(1);
  const slug = prods?.[0]?.slug || 'test';
  console.log('Testing with product slug:', slug);

  const { data, error } = await supabase.rpc('place_order_rpc', {
    p_auth_user_id: null,
    p_customer_id: null,
    p_client_email: null,
    p_client_name: null,
    p_customer_name: 'Test Client',
    p_phone: '+212600000000',
    p_address: 'Casablanca Test Address',
    p_city: 'Casablanca',
    p_items: JSON.stringify([{ slug, quantity: 1 }]),
    p_note: 'Test order',
    p_coupon_code: null,
    p_idempotency_key: 'test-' + Date.now()
  });

  console.log('place_order_rpc call result:', { data, error });
}

testRpc().catch(console.error);
