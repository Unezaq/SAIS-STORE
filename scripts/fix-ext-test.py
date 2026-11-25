with open('scripts/extended-security-tests.sql', 'r', encoding='utf-8') as f:
    content = f.read()

old = """CREATE OR REPLACE FUNCTION _ext_check(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$"""

new = """CREATE OR REPLACE FUNCTION _ext_check(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$"""

assert old in content, "Pattern not found"
content = content.replace(old, new)

with open('scripts/extended-security-tests.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
