with open('docs/REMOTE_DEFAULT_PRIVILEGES_REMEDIATION.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the section to replace (lines 46-70, 0-indexed 45-69)
# We want to replace from line 46 (the separator) to line 69 (GRANT ALL ON FUNCTIONS TO service_role)
# with a new structure

# Find start and end markers
start_marker = "-- ========================================================================\n-- 2. GRANT MINIMAL DEFAULT PRIVILEGES FOR postgres CREATOR\n"
end_marker = "-- service_role retains ALL on all object types (bypasses RLS)\n"

start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if start_marker in ''.join(lines[max(0,i-1):i+1]):
        start_idx = i - 1
    if line.startswith("-- service_role retains ALL on all object types"):
        end_idx = i
        break

print(f"start_idx={start_idx}, end_idx={end_idx}")

# Build replacement
replacement = """-- ========================================================================
-- 2. GRANT MINIMAL DEFAULT PRIVILEGES FOR postgres CREATOR
-- ========================================================================

-- Tables: Grant SELECT to authenticated (RLS filters rows; base privilege needed)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT ON TABLES TO authenticated;

-- Sequences: Grant USAGE to authenticated (needed for SERIAL columns)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO authenticated;

-- Functions: NO default EXECUTE grant to authenticated.
-- Individual RPC grants are handled by migrations (01-08).
-- This ensures new functions are not callable unless explicitly granted.

-- service_role retains ALL on all object types (bypasses RLS)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO service_role;

"""

# Replace from start_idx to end_idx (inclusive of the service_role line block)
# We need to find where the service_role grants end
# Lines 63-69 are the service_role grants
# Let me find the line after the last service_role grant
last_sr_idx = None
for i in range(end_idx, len(lines)):
    if 'GRANT ALL ON FUNCTIONS TO service_role;' in lines[i]:
        last_sr_idx = i
        break

print(f"last_sr_idx={last_sr_idx}")

# Replace from start_idx to last_sr_idx (inclusive)
new_lines = lines[:start_idx] + replacement.split('\n') + ['\n'] + lines[last_sr_idx+1:]

with open('docs/REMOTE_DEFAULT_PRIVILEGES_REMEDIATION.sql', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Done')
print('New line count:', len(new_lines))
