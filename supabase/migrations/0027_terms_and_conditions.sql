-- MOVA — Mandatory Terms & Conditions acceptance
--
-- Independent from public.policy_acceptances (the Buyer Protection & Refund
-- Policy's audit log) — a user must accept both, not one instead of the
-- other. A new table rather than a new policy_acceptances.policy_type value
-- because that table's shape is specific to BPP: its `role` column is typed
-- `user_role`, which has no 'shipper' value (shippers are a separate
-- public.shippers row, optionally linked to a plain buyer/seller-role
-- public.users account — see claimShipper() in app/shipper/actions.ts), and
-- its `context` enum + CHECK constraint tie 'fee_payment' to a
-- purchase_request_id, which doesn't fit T&C's own two contexts.
--
-- Same immutability shape as policy_acceptances: append-only audit log,
-- BEFORE INSERT guard trigger force-stamps accepted_at/role server-side, no
-- update/delete RLS policy for anyone (admin included).
--
-- No denormalized "current acceptance" snapshot on public.users — querying
-- this table directly by (user_id, version) is a single indexed lookup, and
-- avoids extending users_guard_admin_only_fields() to protect a new pair of
-- columns just to let a trusted insert path bypass that same guard.

create type terms_acceptance_context as enum ('signup', 'login_gate');

create table public.terms_acceptances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Derived server-side from public.users at insert time — see the guard
  -- trigger below. Never trusted from the caller. Audit context only (e.g.
  -- "were they a seller when they accepted") — not used for gating.
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
create index terms_acceptances_user_version_idx
  on public.terms_acceptances (user_id, version);
-- Cold path: admin/audit "most recent acceptance for this user".
create index terms_acceptances_user_idx
  on public.terms_acceptances (user_id, accepted_at desc);

alter table public.terms_acceptances enable row level security;

create policy "terms acceptances self or admin read" on public.terms_acceptances
  for select using (user_id = auth.uid() or public.is_admin());

create policy "terms acceptances self insert" on public.terms_acceptances
  for insert with check (user_id = auth.uid());
-- Deliberately no update/delete policy for anyone, admin included —
-- immutable/append-only.

create or replace function public.terms_acceptances_guard()
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

create trigger terms_acceptances_guard
  before insert on public.terms_acceptances
  for each row execute procedure public.terms_acceptances_guard();

revoke execute on function public.terms_acceptances_guard()
  from public, anon, authenticated;
