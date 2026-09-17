-- MOVA — Basic rate limiting (signup, login, chat, reservations)
--
-- One generic counter table + one SECURITY DEFINER function, called only
-- from server-side app code via the service-role client (lib/rate-limit.ts).
-- Not exposed to anon/authenticated at all — a free-form bucket_key granted
-- to end users would let one user grief another's bucket (e.g. spam
-- 'reserve:<victim-uuid>' to lock a real buyer out of reservations), so this
-- stays service-role-only; every call site is trusted server code.
--
-- In-memory counters were ruled out: Netlify Functions are stateless across
-- invocations, so a module-level Map wouldn't be shared or durable. This is
-- the "just works" option the stack already has, no new infra.
--
-- Does NOT duplicate Supabase Auth's own rate limiting (checked against the
-- current docs, not memory): that's a project-wide email-send quota for
-- signup/recovery, and a generous IP-only bucket for the token endpoint
-- (also used by password sign-in) — neither is per-IP for signup or
-- per-email+IP for sign-in the way this app-level layer is.

create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

-- All lookups are "this bucket_key, recent rows" — a composite index on
-- exactly that shape.
create index rate_limit_hits_bucket_created_idx
  on public.rate_limit_hits (bucket_key, created_at);

-- RLS enabled with zero policies blocks anon/authenticated entirely; only
-- service_role (bypasses RLS) and the SECURITY DEFINER function below can
-- touch this table.
alter table public.rate_limit_hits enable row level security;

-- Atomically checks whether bucket_key is under max_count hits within the
-- trailing window_seconds, records this attempt if so, and opportunistically
-- deletes this bucket's stale rows first — keeps the table small without a
-- separate cleanup job.
create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_max_count int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.rate_limit_hits
    where bucket_key = p_bucket_key
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from public.rate_limit_hits
    where bucket_key = p_bucket_key;

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket_key) values (p_bucket_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
