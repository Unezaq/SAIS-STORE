# PostgreSQL Staging Setup and Test Execution Script
# Run this after PostgreSQL installation completes
# Usage: powershell -File scripts/staging-setup.ps1

$PG_BIN = "C:\Users\unezac\pgsql\bin"
$PG_DATA = "C:\Users\unezac\pgsql\data"
$PG_PORT = 5433
$PG_SUPERUSER = "postgres"
$PG_PASSWORD = "StagingTest2026!"
$DB_NAME = "sais_staging"

# Set environment
$env:PGPASSWORD = $PG_PASSWORD
$env:PATH = "$PG_BIN;$env:PATH"

Write-Host "=== Phase 1: Verify PostgreSQL installation ==="
& "$PG_BIN\psql.exe" --version
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: psql not found"; exit 1 }

Write-Host "=== Phase 2: Create staging database ==="
& "$PG_BIN\psql.exe" -h localhost -p $PG_PORT -U $PG_SUPERUSER -c "CREATE DATABASE $DB_NAME;" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "Database may already exist, continuing..." }

Write-Host "=== Phase 3: Apply migrations in order ==="
$migrations = @(
    "supabase/migrations/20261122_sais_store_production.sql",
    "supabase/migrations/20261123_customer_addresses.sql",
    "supabase/migrations/20261123_fix_place_order_rpc_idempotency.sql",
    "supabase/migrations/20261124_01_inventory_ledger_and_order_links.sql",
    "supabase/migrations/20261124_02_cancellation_and_returns.sql",
    "supabase/migrations/20261124_03_coupon_per_user_limits.sql",
    "supabase/migrations/20261124_04_place_order_rpc_integrity.sql",
    "supabase/migrations/20261124_05_rate_limiting.sql",
    "supabase/migrations/20261124_06_revoke_anon_tracking_rpc.sql",
    "supabase/migrations/20261124_07_rls_customer_order_isolation.sql",
    "supabase/migrations/20261124_08_security_definer_hardening.sql"
)

foreach ($m in $migrations) {
    Write-Host "Applying: $m"
    & "$PG_BIN\psql.exe" -h localhost -p $PG_PORT -U $PG_SUPERUSER -d $DB_NAME -f $m -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Migration failed: $m"
        exit 1
    }
    Write-Host "  OK"
}

Write-Host "=== Phase 4: Run security test suite ==="
& "$PG_BIN\psql.exe" -h localhost -p $PG_PORT -U $PG_SUPERUSER -d $DB_NAME -f "supabase/tests/20261121_p0_hardening.sql" 2>&1

Write-Host "=== Phase 5: Verify search_path hardening ==="
& "$PG_BIN\psql.exe" -h localhost -p $PG_PORT -U $PG_SUPERUSER -d $DB_NAME -c "SELECT proname, proconfig FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND proconfig IS NOT NULL;" 2>&1

Write-Host "=== Phase 6: Verify CREATE privileges ==="
& "$PG_BIN\psql.exe" -h localhost -p $PG_PORT -U $PG_SUPERUSER -d $DB_NAME -c "SELECT nspname, has_schema_privilege('anon', 'public', 'CREATE') as anon_create, has_schema_privilege('authenticated', 'public', 'CREATE') as auth_create, has_schema_privilege('service_role', 'public', 'CREATE') as sr_create FROM pg_namespace WHERE nspname = 'public';" 2>&1

Write-Host "=== DONE ==="
Write-Host "Database: $DB_NAME on port $PG_PORT"
Write-Host "Superuser: $PG_SUPERUSER"
Write-Host "Connection: postgresql://$PG_SUPERUSER:$PG_PASSWORD@localhost:$PG_PORT/$DB_NAME"
