-- MOVA — Buyer Protection & Refund Policy acknowledgment
--
-- Two acceptance points:
--   1. Signup (buyer or seller) — a required checkbox in the signup form.
--   2. Fee payment ("Invoice 1") — a required checkbox on the buyer's Pay
--      with Stripe step, confirming agreement to the specific fee/reservation
--      about to be paid.
--
-- SHAPE: a denormalized "current acceptance" snapshot on buyer_profiles /
-- seller_profiles (cheap to query for "who needs to be prompted to
-- re-accept"), plus an append-only audit log (public.policy_acceptances) that
-- is the actual record of reference for a dispute — every acceptance ever
-- made, including ones later superseded by a newer policy_version, with a
-- server-stamped timestamp/IP/user-agent that can never be edited via the
-- API once written.
--
-- PROFILE-ROW TIMING: buyer_profiles/seller_profiles rows aren't created at
-- signup today (seller_profiles only appears once Identity verification
-- starts; buyer_profiles never had a creation path at all) — and this app
-- requires email confirmation before a session exists, so a client-side
-- upsert right after auth.signUp() would have no auth.uid() to write under.
-- Instead, the signup form passes policy_version through
-- auth.signUp()'s user metadata, and handle_new_user() (already
-- security definer, already reads `role` the same way) creates the profile
-- row and the signup-context audit row atomically, in the same trigger that
-- creates public.users — at the moment the checkbox was actually submitted,
-- not whenever email confirmation eventually happens.

create type policy_acceptance_context as enum ('signup', 'fee_payment');

-- 1. Append-only audit log -----------------------------------------------
create table public.policy_acceptances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Derived server-side from public.users at insert time — see the guard
  -- trigger below. Never trusted from the caller.
  role user_role not null,
  context policy_acceptance_context not null,
  policy_version text not null,
  purchase_request_id uuid references public.purchase_requests(id) on delete cascade,
  -- Captured server-side (request headers), never client-supplied.
  ip_address text,
  user_agent text,
  accepted_at timestamptz not null default now(),
  constraint policy_acceptances_context_shape check (
    (context = 'fee_payment' and purchase_request_id is not null) or
    (context = 'signup' and purchase_request_id is null)
  )
);

create index policy_acceptances_user_idx
  on public.policy_acceptances (user_id, accepted_at desc);
create index policy_acceptances_purchase_request_idx
  on public.policy_acceptances (purchase_request_id)
  where purchase_request_id is not null;

alter table public.policy_acceptances enable row level security;

create policy "policy acceptances self or admin read" on public.policy_acceptances
  for select using (user_id = auth.uid() or public.is_admin());

-- Row-level access only. The trigger below is what actually protects
-- accepted_at/role from forgery; this just confirms the caller may log an
-- acceptance for themselves, and — for a fee_payment row — that the
-- reservation cited is actually theirs (an acceptance logged against
-- someone else's reservation would be worthless as evidence).
create policy "policy acceptances self insert" on public.policy_acceptances
  for insert with check (
    user_id = auth.uid()
    and (
      purchase_request_id is null
      or exists (
        select 1 from public.purchase_requests pr
        where pr.id = purchase_request_id and pr.buyer_id = auth.uid()
      )
    )
  );

-- Deliberately no UPDATE or DELETE policy for anyone, admin included. Once
-- written, a row is permanent via the API — a genuine correction would
-- require direct database access outside the app. For something that may be
-- referenced in a dispute, "nothing in the app can alter or delete an
-- acceptance record" is the point.

create or replace function public.policy_acceptances_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- accepted_at is always server time — never a caller-supplied timestamp,
  -- with no carve-out (including admin/service-role: there's no legitimate
  -- reason to backdate one of these).
  new.accepted_at := now();
  -- role is always derived from the account being credited, never
  -- client-settable.
  select role into new.role from public.users where id = new.user_id;
  return new;
end;
$$;

create trigger policy_acceptances_guard
  before insert on public.policy_acceptances
  for each row execute procedure public.policy_acceptances_guard();

revoke execute on function public.policy_acceptances_guard()
  from public, anon, authenticated;

-- 2. Denormalized "current acceptance" snapshot ---------------------------
alter table public.buyer_profiles
  add column policy_accepted_at timestamptz,
  add column policy_version text;

alter table public.seller_profiles
  add column policy_accepted_at timestamptz,
  add column policy_version text;

-- 3. Extend the existing owner-write guard triggers (0010) to cover the two
-- new columns. Same idiom: a self-write is only accepted as a real
-- acceptance when policy_version actually changes to a non-null value —
-- accepted_at is then forced to server now(); a bare timestamp edit, a
-- no-op rewrite, or an attempt to null out a prior acceptance all revert to
-- the previous values instead.

create or replace function public.seller_profiles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
    new.id_verified_at := null;
    if new.id_verification_status <> 'pending' then
      new.id_verification_status := 'unverified';
    end if;
    new.policy_accepted_at := case when new.policy_version is not null then now() else null end;
    return new;
  end if;

  new.verification_status := old.verification_status;
  new.id_verified_at := old.id_verified_at;
  if new.id_verification_status <> 'pending' then
    new.id_verification_status := old.id_verification_status;
  end if;

  if new.policy_version is not null and new.policy_version is distinct from old.policy_version then
    new.policy_accepted_at := now();
  else
    new.policy_version := old.policy_version;
    new.policy_accepted_at := old.policy_accepted_at;
  end if;

  return new;
end;
$$;

create or replace function public.buyer_profiles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.nin_verification_status := 'unverified';
    new.bvn_verification_status := 'unverified';
    new.verification_status := 'unverified';
    new.policy_accepted_at := case when new.policy_version is not null then now() else null end;
    return new;
  end if;

  new.nin_verification_status := old.nin_verification_status;
  new.bvn_verification_status := old.bvn_verification_status;
  new.verification_status := old.verification_status;

  if new.policy_version is not null and new.policy_version is distinct from old.policy_version then
    new.policy_accepted_at := now();
  else
    new.policy_version := old.policy_version;
    new.policy_accepted_at := old.policy_accepted_at;
  end if;

  return new;
end;
$$;

-- 4. Seed the profile row + signup-context audit row at account creation --
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_policy_version text;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer');
  v_policy_version := nullif(new.raw_user_meta_data->>'policy_version', '');

  insert into public.users (id, email, role, status)
  values (new.id, new.email, v_role, 'active');

  if v_role = 'buyer' then
    insert into public.buyer_profiles (user_id, policy_version)
    values (new.id, v_policy_version);
  elsif v_role = 'seller' then
    insert into public.seller_profiles (user_id, policy_version)
    values (new.id, v_policy_version);
  end if;

  -- Only log an acceptance if the signup form actually sent one — an admin-
  -- created account or any future signup path that doesn't pass
  -- policy_version shouldn't fabricate an acceptance that was never given.
  if v_policy_version is not null then
    insert into public.policy_acceptances (user_id, role, context, policy_version)
    values (new.id, v_role, 'signup', v_policy_version);
  end if;

  return new;
end;
$$;
