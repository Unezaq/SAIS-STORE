import re

with open('supabase/tests/20261121_p0_hardening.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix customer name 'X' -> 'XX' in all place_order_rpc calls
content = content.replace("'X','+212600000001'", "'XX','+212600000001'")
content = content.replace("'X','+212600000002'", "'XX','+212600000002'")
content = content.replace("'X','+212600000099'", "'XX','+212600000099'")

# Fix 15.1: p0-a price is 100, not 200
content = content.replace('where unit_price = 200.00) = 1', 'where unit_price = 100.00) = 1')

# Fix 15.2: subtotal should be 399 (100 + 299), not 499
content = content.replace('subtotal = 499.00 from _p0_mixed', 'subtotal = 399.00 from _p0_mixed')

with open('supabase/tests/20261121_p0_hardening.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
print('Remaining X names:', content.count("'X','+212"))
print('200.00 refs:', content.count('200.00) = 1'))
print('499.00 refs:', content.count('499.00'))