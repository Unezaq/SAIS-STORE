with open('supabase/tests/20261121_p0_hardening.sql', 'r', encoding='utf-8') as f:
    content = f.read()

old = "'COUPON_EPUISE'"
new = "'COUPON_INVALIDE'"
count = content.count(old)
content = content.replace(old, new)

with open('supabase/tests/20261121_p0_hardening.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Replaced {count} occurrence(s)')
