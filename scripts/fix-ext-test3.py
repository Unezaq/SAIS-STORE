with open('scripts/extended-security-tests.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: cleanup_rate_limits DO block
old1 = """DO $$
BEGIN
    BEGIN
        PERFORM public.cleanup_rate_limits();
        INSERT INTO _ext_results (name, ok, detail) VALUES ('EXT-19 cleanup_rate_limits rejects non-admin', false, 'no error raised')
        ON CONFLICT (name) DO UPDATE SET ok = excluded.ok, detail = excluded.detail;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO _ext_results (name, ok, detail) VALUES ('EXT-19 cleanup_rate_limits rejects non-admin', SQLERRM ILIKE '%NON_AUTORISE%', SQLERRM)
        ON CONFLICT (name) DO UPDATE SET ok = excluded.ok, detail = excluded.detail;
    END;
END;
$$;"""

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

assert old1 in content, "Pattern 1 not found"
content = content.replace(old1, new1)

# Fix 2: oversell DO block
# Find the second DO block
import re
# Replace all remaining "INSERT INTO _ext_results" inside DO blocks
# by finding the oversell DO block
old2_start = content.find("DO $$\nBEGIN\n    BEGIN\n        PERFORM * FROM public.place_order_rpc(")
old2_end = content.find("$$;", old2_start) + 3
old2 = content[old2_start:old2_end]

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

content = content[:old2_start] + new2 + content[old2_end:]

with open('scripts/extended-security-tests.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
