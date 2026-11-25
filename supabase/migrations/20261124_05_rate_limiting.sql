-- ========================================================================
-- SAIS Store — Database-Backed Rate Limiting
-- Migration: 20261124_05_rate_limiting.sql
-- Description:
--   Creates public.rate_limits — a fixed-window counter table backed by
--   PostgreSQL (atomic UPSERT), replacing the in-memory Map in
--   lib/security/rateLimit.ts so limits survive restarts and work across
--   server instances.
--
-- Fixed-window: each row is (identifier, window_start, count). A request
-- atomically increments the count for the current window; when the count
-- exceeds max, the request is rejected. Windows roll over by time.
--
-- Strategy: expand only. No existing tables modified.
-- ========================================================================

create table if not exists public.rate_limits (
  identifier text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (identifier, window_start)
);

create index if not exists idx_rate_limits_identifier_window
  on public.rate_limits(identifier, window_start);

-- ------------------------------------------------------------------------
-- RLS — rate_limits is internal. No public, no customer access.
-- Admin can inspect (read-only) for operations monitoring.
-- ------------------------------------------------------------------------
alter table public.rate_limits enable row level security;

drop policy if exists "Admin read rate limits" on public.rate_limits;
create policy "Admin read rate limits" on public.rate_limits
  for select to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE policy for authenticated or anon — the rate-limit
-- function (SECURITY DEFINER) performs the UPSERT with service_role-like
-- privileges via the function owner. Direct table writes are blocked.
revoke all on public.rate_limits from public, anon, authenticated;

-- ------------------------------------------------------------------------
-- SECURITY DEFINER: atomic check-and-increment.
-- Returns {allowed: boolean, retry_after_ms: integer|null}.
-- ------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_identifier text,
  p_max integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after_ms integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_row record;
begin
  -- Clamp caller-supplied parameters so an exposed call cannot create huge
  -- windows or bypass limits with absurd values.
  p_max := greatest(1, least(coalesce(p_max, 10), 100000));
  p_window_ms := greatest(1000, least(coalesce(p_window_ms, 60000), 86400000));

  -- Align window start to a fixed boundary (epoch + multiple of window_ms).
  -- floor() is required: bigint / numeric does not truncate, so without it
  -- every request would land in its own window and never be limited.
  v_window_start := to_timestamp((
    floor(extract(epoch from v_now) / (p_window_ms / 1000.0)) * (p_window_ms / 1000.0)
  )::double precision);
  v_window_end := v_window_start + (p_window_ms * interval '1 millisecond');

  -- Atomic upsert: insert new row or increment existing row for this window.
  insert into public.rate_limits (identifier, window_start, count, updated_at)
  values (p_identifier, v_window_start, 1, v_now)
  on conflict (identifier, window_start) do update
  set count = rate_limits.count + 1,
      updated_at = v_now
  returning count, window_start into v_row;

  if v_row.count > p_max then
    return query select false,
      greatest(0, ceil(extract(epoch from (v_window_end - v_now)) * 1000.0))::integer;
  else
    return query select true, null::integer;
  end if;
end;
$$;

-- The rate limiter is an internal server-side primitive. Only the trusted
-- service role may call it: granting it to anon/authenticated would let any
-- visitor poison another phone number's counter (unlimited writes to
-- rate_limits) and bypass the configured window/max.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Explicit direct-table grant for the service role (server-side admin client).
grant all on public.rate_limits to service_role;

-- ------------------------------------------------------------------------
-- Cleanup function (admin only — removes expired windows).
-- ------------------------------------------------------------------------
create or replace function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer := 0;
  v_caller uuid := auth.uid();
begin
  -- Authorization: a signed-in caller must be an admin. The service_role
  -- path (no auth.uid()) is the trusted server/cron and is allowed.
  if v_caller is not null and not public.is_admin() then
    raise exception 'NON_AUTORISE: Privilèges admin requis pour le nettoyage des limites de débit.';
  end if;

  delete from public.rate_limits
  where window_start < now() - interval '7 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Admin sessions (authenticated + is_admin) and the service role may run it.
-- Anonymous callers are explicitly excluded.
revoke all on function public.cleanup_rate_limits() from public, anon;
grant execute on function public.cleanup_rate_limits() to authenticated, service_role;

-- ========================================================================
-- END
-- ========================================================================
