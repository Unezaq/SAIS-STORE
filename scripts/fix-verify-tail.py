with open('docs/REMOTE_SUPABASE_VERIFICATION.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the tail section starting from "-- Return all check results"
marker = "-- Return all check results\n"
idx = content.find(marker)
assert idx >= 0, "Marker not found"

# Replace everything from the marker to the end
new_tail = """-- Return all check results followed by summary row
SELECT check_id, category, check_name, status, actual_value, expected_value, details
FROM (
    SELECT check_id, category, check_name, status, actual_value, expected_value, details, 0 AS sort_order
    FROM checks

    UNION ALL

    SELECT 'SUMMARY' AS check_id,
           'Summary' AS category,
           'FINAL VERDICT' AS check_name,
           CASE WHEN (SELECT count(*) FROM checks WHERE status = 'FAIL') = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
           'passed=' || (SELECT count(*) FILTER (WHERE status = 'PASS')::text FROM checks)
               || ', failed=' || (SELECT count(*) FILTER (WHERE status = 'FAIL')::text FROM checks)
               || ', warnings=' || (SELECT count(*) FILTER (WHERE status = 'WARNING')::text FROM checks)
               || ', info=' || (SELECT count(*) FILTER (WHERE status = 'INFO')::text FROM checks) AS actual_value,
           'failed=0, warnings=0' AS expected_value,
           'total_checks=' || (SELECT count(*)::text FROM checks) AS details,
           1 AS sort_order
) AS all_results
ORDER BY sort_order, check_id;
"""

content = content[:idx] + new_tail

with open('docs/REMOTE_SUPABASE_VERIFICATION.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
