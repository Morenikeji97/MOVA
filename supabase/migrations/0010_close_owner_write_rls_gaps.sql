-- MOVA — close the rest of the "owner update/insert with no column-level
-- check" RLS gap already found and fixed on vehicles (0007/0009).
--
-- RLS policies are row-level only; USING/WITH CHECK expressions in this
-- schema gate ownership ("this row is mine"), not which columns may change.
-- Several owner-writable tables carry at least one column that's supposed to
-- be an admin- or system-only decision, and nothing stops the owner from
-- setting it directly via the API. Same fix pattern as 0007/0009: a BEFORE
-- INSERT/UPDATE trigger that reverts those specific columns for anyone who
-- isn't public.is_admin() or the service role (auth.role() = 'service_role'
-- — the Postgres role a request authenticated with the secret/service-role
-- key runs as; no end-user key can produce it).
--
-- Found, most severe first:
--
-- 1. public.users — "users update own" has no WITH CHECK at all, so any
--    signed-in user can PATCH their own row's `role` straight to 'admin',
--    which is an instant, total privilege escalation: public.is_admin() (and
--    therefore every admin gate in every other RLS policy across this
--    schema) is defined purely as `users.role = 'admin'` for auth.uid().
--    `status` (active/suspended) and `email_verified_at` are the same class
--    of self-service-decision field. Guarded: UPDATE only — the one INSERT
--    path (handle_new_user(), on auth.users signup) doesn't go through
--    PostgREST/RLS at all, and no app code ever inserts into public.users
--    directly.
--
-- 2. public.seller_profiles / public.buyer_profiles — "owner write" is
--    `for all` with an explicit WITH CHECK, but it only re-asserts
--    ownership, not which columns changed. A seller/buyer could set their
--    own id_verification_status / nin_verification_status /
--    bvn_verification_status / verification_status straight to 'verified',
--    forging KYC the app believes came from Stripe Identity (seller) or a
--    NIN/BVN check (buyer, not implemented yet). The one legitimate
--    self-service write today (app/seller/verification/actions.ts) only
--    ever sets id_verification_status to 'pending' — that stays allowed;
--    'verified'/'failed' and id_verified_at remain reserved for the Stripe
--    Identity webhook, which writes via the service role.
--
-- 3. public.notifications — "owner update read state" lets a user rewrite
--    their own notification's `type`/`payload`, not just mark it read.
--    Self-only impact (no cross-user exposure) and the feature has no
--    reader/writer in the app yet, but it's the same shape of gap, so it's
--    closed the same way: only `read_at` is left self-editable.
--
-- 4. public.vehicle_documents — "vehicle documents write by owner" (INSERT
--    only; there's no UPDATE policy) doesn't pin `visibility`, so a seller's
--    insert could set visibility = 'public' on a document — title/
--    registration docs can carry PII — that only an admin should be
--    exposing. No upload flow calls this yet, but it's the same pattern.

-- 1. users -------------------------------------------------------------------
create or replace function public.users_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.role := old.role;
  new.status := old.status;
  new.email_verified_at := old.email_verified_at;
  return new;
end;
$$;

create trigger users_guard_admin_only_fields
  before update on public.users
  for each row execute procedure public.users_guard_admin_only_fields();

-- 2a. seller_profiles ----------------------------------------------------
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
    return new;
  end if;

  new.verification_status := old.verification_status;
  new.id_verified_at := old.id_verified_at;
  if new.id_verification_status <> 'pending' then
    new.id_verification_status := old.id_verification_status;
  end if;
  return new;
end;
$$;

create trigger seller_profiles_guard_admin_only_fields
  before insert or update on public.seller_profiles
  for each row execute procedure public.seller_profiles_guard_admin_only_fields();

-- 2b. buyer_profiles -------------------------------------------------------
-- No self-service transition exists yet (no NIN/BVN check is wired up), so
-- these three are fully admin/service-role-only, same as vin_verification_status.
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
    return new;
  end if;

  new.nin_verification_status := old.nin_verification_status;
  new.bvn_verification_status := old.bvn_verification_status;
  new.verification_status := old.verification_status;
  return new;
end;
$$;

create trigger buyer_profiles_guard_admin_only_fields
  before insert or update on public.buyer_profiles
  for each row execute procedure public.buyer_profiles_guard_admin_only_fields();

-- 3. notifications -----------------------------------------------------------
create or replace function public.notifications_guard_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.user_id := old.user_id;
  new.type := old.type;
  new.payload := old.payload;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger notifications_guard_owner_fields
  before update on public.notifications
  for each row execute procedure public.notifications_guard_owner_fields();

-- 4. vehicle_documents ------------------------------------------------------
create or replace function public.vehicle_documents_guard_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    new.visibility := 'admin_only';
  end if;
  return new;
end;
$$;

create trigger vehicle_documents_guard_visibility
  before insert on public.vehicle_documents
  for each row execute procedure public.vehicle_documents_guard_visibility();

-- These trigger functions are internal-only, never meant to be called
-- directly via RPC (see the same reasoning for vehicles_guard_admin_only_fields
-- in 0008).
revoke execute on function public.users_guard_admin_only_fields() from public, anon, authenticated;
revoke execute on function public.seller_profiles_guard_admin_only_fields() from public, anon, authenticated;
revoke execute on function public.buyer_profiles_guard_admin_only_fields() from public, anon, authenticated;
revoke execute on function public.notifications_guard_owner_fields() from public, anon, authenticated;
revoke execute on function public.vehicle_documents_guard_visibility() from public, anon, authenticated;
