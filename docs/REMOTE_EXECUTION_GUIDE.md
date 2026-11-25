# SAIS STORE — REMOTE EXECUTION GUIDE

## What to back up
Before running any SQL, create a backup of your Supabase database:
1. Go to: https://supabase.com/dashboard/project/dlkrjwsapwsjnqwkzjes/database/backups
2. Click "Create backup" or ensure daily backups are enabled
3. Note the backup timestamp

## Which SQL file to execute
Execute `docs/REMOTE_SUPABASE_REMEDIATION.sql` — this is a single file containing all 8 migrations in dependency order with precondition and post-migration verification checks.

## How to execute
1. Go to: https://supabase.com/dashboard/project/dlkrjwsapwsjnqwkzjes/sql
2. Click "New query"
3. Copy the ENTIRE contents of `docs/REMOTE_SUPABASE_REMEDIATION.sql`
4. Paste into the SQL editor
5. Click "Run" (or press Ctrl+Enter)

## What successful output looks like
You should see messages like:
```
PRECONDITION CHECKS PASSED
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
...
ALL POST-MIGRATION VERIFICATION CHECKS PASSED
```

If you see `ERROR:` at any point, STOP. Do not continue. Report the error.

## What to do if an error occurs
1. Note the exact error message
2. Note which migration/step failed (the error will reference a line number)
3. Do NOT re-run the script from the beginning — the failed statement and all subsequent statements were rolled back
4. Report the error for investigation
5. The database remains in its pre-migration state (no partial changes)

## How to run verification
After successful execution, run `docs/REMOTE_SUPABASE_VERIFICATION.sql`:
1. Go to: https://supabase.com/dashboard/project/dlkrjwsapwsjnqwkzjes/sql
2. Click "New query"
3. Copy the ENTIRE contents of `docs/REMOTE_SUPABASE_VERIFICATION.sql`
4. Paste and click "Run"
5. Every check should return `true` or the expected value
6. If any check returns `false` or unexpected, report it

## How to report the result
After execution, provide:
1. Screenshot or text output of the remediation script (showing "ALL POST-MIGRATION VERIFICATION CHECKS PASSED")
2. Screenshot or text output of the verification script (showing all checks returning expected values)
3. Any error messages encountered
4. The timestamp of the backup created before execution

## Important notes
- The script uses `\i` (include) directives to reference individual migration files. If the SQL Editor doesn't support `\i`, you may need to paste each migration file individually in order (01 through 08).
- The script is idempotent — safe to re-run if it fails partway through (all statements use `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP IF EXISTS`).
- No existing data will be modified or deleted.
- The script takes approximately 5-10 seconds to execute.
- If you encounter a permission error, ensure you're logged in as the project owner (not a team member with limited access).

## Estimated execution time
- Remediation script: 5-10 seconds
- Verification script: 2-5 seconds
- Total: under 1 minute
