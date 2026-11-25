with open('scripts/extended-security-tests.sql', 'r', encoding='utf-8') as f:
    content = f.read()

old = """DO $$
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

new = """DO $$
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

assert old in content, "Pattern not found"
content = content.replace(old, new)

# Also fix the oversell test (line ~214) which has the same pattern
old2 = """DO $$
BEGIN
    BEGIN
        PERFORM * FROM public.place_order_rpc(
            NULL, NULL, NULL, NULL,
            'Oversell Test', '+212633333333', 'Addr', 'Tanger',
            '[{\"slug\":\"test-prod\",\"quantity\":3}]'::jsonb, NULL, NULL, 'ext-oversell-1'
        );
        INSERT INTO _ext_results (name, ok, detail) VALUES ('EXT-26 oversell rejected', false, 'no error raised')
        ON CONFLICT (name) DO UPDATE SET ok = excluded.ok, detail = excluded.detail;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO _ext_results (name, ok, detail) VALUES ('EXT-26 oversell rejected', SQLERRM ILIKE '%STOCK_INSUFFISANT%', SQLERRM)
        ON CONFLICT (name) DO UPDATE SET ok = excluded.ok, detail = excluded.detail;
    END;
END;
$$;"""

new2 = """DO $$
DECLARE
    v_ok boolean;
    v_detail text;
BEGIN
    BEGIN
        PERFORM * FROM public.place_order_rpc(
            NULL, NULL, NULL, NULL,
            'Oversell Test', '+212633333333', 'Addr', 'Tanger',
            '[{\"slug\":\"test-prod\",\"quantity\":3}]'::jsonb, NULL, NULL, 'ext-oversell-1'
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

assert old2 in content, "Pattern 2 not found"
content = content.replace(old2, new2)

with open('scripts/extended-security-tests.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
