with open('scripts/extended-security-tests.sql', 'r', encoding='utf-8') as f:
    content = f.read()

content_lf = content.replace('\r\n', '\n')

# Fix 1: cleanup_rate_limits DO block
import re
# Find the first DO block (cleanup)
pattern1 = re.compile(r"DO \$\$\nBEGIN\n    BEGIN\n        PERFORM public\.cleanup_rate_limits\(\);\n        INSERT INTO _ext_results.*?END;\nEND;\n\$\$;", re.DOTALL)
match1 = pattern1.search(content_lf)
assert match1, "Pattern 1 not found"
new1 = """DO $$
DECLARE
    v_ok boolean;
    v_detail text;
BEGIN
    BEGIN
        PERFORM public.cleanup_rate_limits();
        v_ok := false;
        v_detail := 'no error raised';
    EXCEPTION WHEN OTHERS THEN
        v_ok := SQLERRM ILIKE '%NON_AUTORISE%';
        v_detail := SQLERRM;
    END;
    PERFORM _ext_check('EXT-19 cleanup_rate_limits rejects non-admin', v_ok, v_detail);
END;
$$;"""
content_lf = content_lf[:match1.start()] + new1 + content_lf[match1.end():]

# Fix 2: oversell DO block
pattern2 = re.compile(r"DO \$\$\nBEGIN\n    BEGIN\n        PERFORM \* FROM public\.place_order_rpc\(.*?END;\nEND;\n\$\$;", re.DOTALL)
match2 = pattern2.search(content_lf)
assert match2, "Pattern 2 not found"
new2 = """DO $$
DECLARE
    v_ok boolean;
    v_detail text;
BEGIN
    BEGIN
        PERFORM * FROM public.place_order_rpc(
            NULL, NULL, NULL, NULL,
            'Oversell Test', '+212633333333', 'Addr', 'Tanger',
            '[{"slug":"test-prod","quantity":3}]'::jsonb, NULL, NULL, 'ext-oversell-1'
        );
        v_ok := false;
        v_detail := 'no error raised';
    EXCEPTION WHEN OTHERS THEN
        v_ok := SQLERRM ILIKE '%STOCK_INSUFFISANT%';
        v_detail := SQLERRM;
    END;
    PERFORM _ext_check('EXT-26 oversell rejected', v_ok, v_detail);
END;
$$;"""
content_lf = content_lf[:match2.start()] + new2 + content_lf[match2.end():]

# Write back with CRLF
content = content_lf.replace('\n', '\r\n')
with open('scripts/extended-security-tests.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
