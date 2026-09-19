-- MOVA — Mandatory Privacy Policy acceptance
--
-- Same immutability shape as public.terms_acceptances (0027): a separate
-- table per document, not a policy_type discriminator column on a shared
-- table — matches the reasoning already recorded in 0027's own comment for
-- why Terms & Conditions didn't get folded into public.policy_acceptances
-- either. Reuses terms_acceptance_context (signup/login_gate) as-is: that
-- enum was already generic ("when was this accepted"), not Terms-specific
-- in meaning, so a second document doesn't need its own copy.
--
-- Independent of public.terms_acceptances — a user must accept both, not
-- one instead of the other. The mandatory-acceptance gate (see
-- lib/supabase/middleware.ts) requires a current-version row in BOTH tables
-- before releasing a non-admin authenticated request.

create table public.privacy_policy_acceptances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Derived server-side from public.users at insert time — see the guard
  -- trigger below. Never trusted from the caller. Audit context only.
  role user_role not null,
  context terms_acceptance_context not null,
  version text not null,
  -- Captured server-side (request headers), never client-supplied.
  ip_address text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

-- Hot path: "does this user have a row for the current version" — checked by
-- middleware on every authenticated request.
create index privacy_policy_acceptances_user_version_idx
  on public.privacy_policy_acceptances (user_id, version);
-- Cold path: admin/audit "most recent acceptance for this user".
create index privacy_policy_acceptances_user_idx
  on public.privacy_policy_acceptances (user_id, accepted_at desc);

alter table public.privacy_policy_acceptances enable row level security;

create policy "privacy policy acceptances self or admin read" on public.privacy_policy_acceptances
  for select using (user_id = auth.uid() or public.is_admin());

create policy "privacy policy acceptances self insert" on public.privacy_policy_acceptances
  for insert with check (user_id = auth.uid());
-- Deliberately no update/delete policy for anyone, admin included —
-- immutable/append-only.

create or replace function public.privacy_policy_acceptances_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.accepted_at := now();
  select role into new.role from public.users where id = new.user_id;
  return new;
end;
$$;

create trigger privacy_policy_acceptances_guard
  before insert on public.privacy_policy_acceptances
  for each row execute procedure public.privacy_policy_acceptances_guard();

revoke execute on function public.privacy_policy_acceptances_guard()
  from public, anon, authenticated;
