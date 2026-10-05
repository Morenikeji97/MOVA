-- Admin audit log (MVP NOW #4, docs/architecture-review.md §3 and §2.5).
--
-- One row per admin action (approve a listing, confirm a payment, release a
-- reservation…), written by the app through log_admin_action() after the
-- action's own write is confirmed (lib/admin-audit.ts). Not trigger-only:
-- the app knows *why* (the action and its details), the database alone
-- doesn't. Stage changes on deals are also in transaction_status_history.
--
-- Trustworthy by construction:
--   - the actor is auth.uid() of the calling admin session, never a
--     parameter, and the function refuses non-admins (is_admin(): aal2);
--   - no API role can insert, update or delete rows directly;
--   - append-only for everyone (trigger), so entries can't be edited away;
--   - admin_id is a plain uuid (no FK), so the log outlives accounts.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  admin_id uuid not null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_table text not null check (target_table ~ '^[a-z_]+$'),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_table, target_id, seq);
create index if not exists admin_audit_log_admin_idx on public.admin_audit_log (admin_id, seq);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin audit log admin read" on public.admin_audit_log;
create policy "admin audit log admin read" on public.admin_audit_log
  for select using (public.is_admin());

revoke insert, update, delete, truncate on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create or replace function public.admin_audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_log is append-only' using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists admin_audit_log_append_only on public.admin_audit_log;
create trigger admin_audit_log_append_only
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();

create or replace function public.log_admin_action(
  p_action text,
  p_target_table text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'log_admin_action: admin session (with code) required'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.admin_audit_log (admin_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_target_table, p_target_id, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
