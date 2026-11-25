// Concurrency Test for SAIS Store PostgreSQL Staging
// Tests: idempotency, stock guards, rate limit atomicity
// Usage: node scripts/concurrency-test.js

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'sais_staging',
    user: 'postgres',
    password: 'StagingTest2026!',
    max: 20,
});

async function setSession(client, userId, role) {
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: role || 'authenticated' }),
    ]);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
}

async function runTest(name, fn) {
    console.log(`\n=== ${name} ===`);
    try {
        const result = await fn();
        console.log(`RESULT: ${result}`);
        return result;
    } catch (e) {
        console.log(`ERROR: ${e.message}`);
        return null;
    }
}

async function main() {
    // Setup test data
    const setupClient = await pool.connect();
    await setupClient.query('BEGIN');

    // Create test product with stock = 2
    await setupClient.query(`
        INSERT INTO public.products (id, title, slug, price, image_url, stock, is_active)
        VALUES ('cccccccc-0000-0000-0000-000000000001', 'Concurrency Product', 'conc-prod', 100.00, '/conc.jpg', 2, true)
        ON CONFLICT (slug) DO UPDATE SET stock = 2
    `);

    // Create test user
    await setupClient.query(`
        INSERT INTO auth.users (id, email, app_metadata) VALUES
            ('cccccccc-0000-0000-0000-000000000010', 'conctest@test.com', '{"role":"customer"}'::jsonb)
        ON CONFLICT (id) DO NOTHING
    `);
    await setupClient.query(`
        INSERT INTO public.profiles (id, full_name, role) VALUES
            ('cccccccc-0000-0000-0000-000000000010', 'Conc Test User', 'customer')
        ON CONFLICT (id) DO NOTHING
    `);

    await setupClient.query('COMMIT');
    setupClient.release();

    // =====================
    // TEST A: Idempotency (5 concurrent requests, same key)
    // =====================
    await runTest('A. Idempotency - 5 concurrent requests with same key', async () => {
        const key = 'conc-idem-' + Date.now();
        const promises = [];
        for (let i = 0; i < 5; i++) {
            const client = await pool.connect();
            promises.push((async () => {
                try {
                    await client.query('BEGIN');
                    await setSession(client, 'cccccccc-0000-0000-0000-000000000010', 'authenticated');
                    const res = await client.query(
                        `SELECT * FROM public.place_order_rpc($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                        [null, null, null, null, 'Conc User', '+212655555555', 'Addr', 'Casablanca',
                         JSON.stringify([{ slug: 'conc-prod', quantity: 1 }]), null, null, key]
                    );
                    await client.query('COMMIT');
                    return { ok: true, order_id: res.rows[0]?.order_id };
                } catch (e) {
                    await client.query('ROLLBACK').catch(() => {});
                    return { ok: false, error: e.message };
                } finally {
                    client.release();
                }
            })());
        }
        const results = await Promise.all(promises);
        const successes = results.filter(r => r.ok);
        const uniqueOrders = new Set(successes.map(r => r.order_id));
        console.log('  Total requests:', results.length);
        console.log('  Successful:', successes.length);
        console.log('  Failed:', results.filter(r => !r.ok).length);
        console.log('  Unique order IDs:', uniqueOrders.size);
        if (successes.length > 0) {
            console.log('  Order IDs:', [...uniqueOrders]);
        }
        console.log('  All resolve to same order:', uniqueOrders.size === 1);
        return uniqueOrders.size === 1 ? 'PASS' : 'FAIL';
    });

    // =====================
    // TEST B: Stock (stock=2, two concurrent purchases of 2 units)
    // =====================
    await runTest('B. Stock - concurrent purchases, stock=2, each wants 2', async () => {
        // Reset stock to 2
        const resetClient = await pool.connect();
        await resetClient.query('UPDATE public.products SET stock = 2 WHERE slug = $1', ['conc-prod']);
        resetClient.release();

        const promises = [];
        for (let i = 0; i < 2; i++) {
            const client = await pool.connect();
            const phone = `+21265555555${i}`;
            promises.push((async () => {
                try {
                    await client.query('BEGIN');
                    await setSession(client, 'cccccccc-0000-0000-0000-000000000010', 'authenticated');
                    const res = await client.query(
                        `SELECT * FROM public.place_order_rpc($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                        [null, null, null, null, 'Conc User', phone, 'Addr', 'Casablanca',
                         JSON.stringify([{ slug: 'conc-prod', quantity: 2 }]), null, null, 'conc-stock-' + i + '-' + Date.now()]
                    );
                    await client.query('COMMIT');
                    return { ok: true, order_id: res.rows[0]?.order_id };
                } catch (e) {
                    await client.query('ROLLBACK').catch(() => {});
                    return { ok: false, error: e.message };
                } finally {
                    client.release();
                }
            })());
        }
        const results = await Promise.all(promises);
        const successes = results.filter(r => r.ok);
        const failures = results.filter(r => !r.ok);
        console.log('  Total requests:', results.length);
        console.log('  Successful:', successes.length);
        console.log('  Failed:', failures.length);
        if (failures.length > 0) {
            console.log('  Failure reasons:', failures.map(f => f.error).join('; '));
        }

        // Check final stock
        const stockClient = await pool.connect();
        const stockRes = await stockClient.query("SELECT stock FROM public.products WHERE slug = 'conc-prod'");
        const finalStock = stockRes.rows[0]?.stock;
        stockClient.release();
        console.log('  Final stock:', finalStock);
        console.log('  At most one succeeded:', successes.length <= 1);
        console.log('  Stock never negative:', finalStock >= 0);
        return (successes.length <= 1 && finalStock >= 0) ? 'PASS' : 'FAIL';
    });

    // =====================
    // TEST C: Rate limiting atomicity
    // =====================
    await runTest('C. Rate Limit - concurrent requests around threshold', async () => {
        const identifier = 'conc-rate-' + Date.now();
        const threshold = 5;
        const promises = [];
        for (let i = 0; i < 10; i++) {
            const client = await pool.connect();
            promises.push((async () => {
                try {
                    const res = await client.query(
                        'SELECT allowed, retry_after_ms FROM public.check_rate_limit($1, $2, $3)',
                        [identifier, threshold, 60000]
                    );
                    return { allowed: res.rows[0]?.allowed, retry: res.rows[0]?.retry_after_ms };
                } catch (e) {
                    return { allowed: null, error: e.message };
                } finally {
                    client.release();
                }
            })());
        }
        const results = await Promise.all(promises);
        const allowed = results.filter(r => r.allowed === true).length;
        const blocked = results.filter(r => r.allowed === false).length;
        const errors = results.filter(r => r.allowed === null).length;
        console.log('  Total requests:', results.length);
        console.log('  Allowed:', allowed);
        console.log('  Blocked:', blocked);
        console.log('  Errors:', errors);
        if (errors > 0) console.log('  Error details:', results.filter(r => r.error).map(r => r.error));

        // Check DB counter
        const countClient = await pool.connect();
        const countRes = await countClient.query('SELECT count FROM public.rate_limits WHERE identifier = $1', [identifier]);
        const dbCount = countRes.rows[0]?.count;
        countClient.release();
        console.log('  DB counter:', dbCount);
        console.log('  Counter matches requests:', dbCount === 10);
        console.log('  Allowed count <= threshold:', allowed <= threshold);
        return (allowed <= threshold && dbCount === 10 && errors === 0) ? 'PASS' : 'FAIL';
    });

    // Cleanup
    const cleanupClient = await pool.connect();
    await cleanupClient.query('DELETE FROM public.orders WHERE phone IN (+212655555550,+212655555551)');
    await cleanupClient.query("DELETE FROM public.rate_limits WHERE identifier LIKE 'conc-rate-%'");
    await cleanupClient.query("DELETE FROM public.products WHERE slug = 'conc-prod'");
    cleanupClient.release();

    await pool.end();
    console.log('\n=== ALL CONCURRENCY TESTS COMPLETE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
