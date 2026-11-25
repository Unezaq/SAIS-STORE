# Inline all 8 migrations into the remediation SQL file
with open('docs/REMOTE_SUPABASE_REMEDIATION.sql', 'r', encoding='utf-8') as f:
    content = f.read()

migrations = [
    '20261124_01_inventory_ledger_and_order_links.sql',
    '20261124_02_cancellation_and_returns.sql',
    '20261124_03_coupon_per_user_limits.sql',
    '20261124_04_place_order_rpc_integrity.sql',
    '20261124_05_rate_limiting.sql',
    '20261124_06_revoke_anon_tracking_rpc.sql',
    '20261124_07_rls_customer_order_isolation.sql',
    '20261124_08_security_definer_hardening.sql',
]

for m in migrations:
    path = f'supabase/migrations/{m}'
    with open(path, 'r', encoding='utf-8') as f:
        migration_content = f.read()
    
    # Replace the \i directive with the actual content
    old_directive = f"\\i supabase/migrations/{m}"
    new_content = f"-- BEGIN: {m}\n{migration_content}\n-- END: {m}"
    assert old_directive in content, f"Directive not found for {m}"
    content = content.replace(old_directive, new_content)

with open('docs/REMOTE_SUPABASE_REMEDIATION.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done - all migrations inlined')
print('File size:', len(content), 'bytes')
