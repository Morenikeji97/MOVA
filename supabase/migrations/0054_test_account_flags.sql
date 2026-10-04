-- Test accounts and test shipper applications: marked so admin counts and
-- metrics can leave them out.
--
-- Production and every deploy preview share one database, so test accounts
-- (e.g. the e2e WebKit test seller, docs/LAUNCH-BLOCKERS.md) live next to
-- real ones. `is_test_account` marks them; the admin dashboard excludes
-- their users, listings, reservations and shipments from its counts.
--
-- users.is_test_account is admin-only, like role and status: the "users update own" RLS policy
-- doesn't restrict columns, so the guard trigger pins the flag for everyone
-- else (the owner-write gap pattern, migration 0010). The function body is
-- 0051's (live + referral columns) plus the new flag. Set it with:
--   update public.users set is_test_account = true where email = '…';
-- as an admin session or the service role.

alter table public.users add column if not exists is_test_account boolean not null default false;

create or replace function public.users_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_test_account := false;
    return new;
  end if;
  new.role := old.role;
  new.status := old.status;
  new.email_verified_at := old.email_verified_at;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.signup_ip := old.signup_ip;
  new.signup_device_fingerprint := old.signup_device_fingerprint;
  new.is_test_account := old.is_test_account;
  return new;
end;
$$;

drop trigger if exists users_guard_admin_only_fields on public.users;
create trigger users_guard_admin_only_fields
  before insert or update on public.users
  for each row execute function public.users_guard_admin_only_fields();

-- The guard triggers revert writes that aren't from an admin or the service
-- role, so the flag updates below run as the service role (transaction-local).
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- The founder's test logins (2026-10-04). Not tbakare2@gmail.com (their own
-- seller account) and not the admin.
update public.users set is_test_account = true
where email in (
  'tbakare2+buyer@gmail.com',
  'tbakare2+buyer2@gmail.com',
  'tbakare2+ref1@gmail.com',
  'tbakare2+shipper@gmail.com',
  'tbakare2+e2e-webkit@gmail.com'
);

-- ── Shipper applications ────────────────────────────────────────────────────
-- Same idea for shippers, which aren't users (an application has no login
-- until approved). Admin-only via the shipper guard: the live body (0053)
-- plus is_test.
alter table public.shippers add column if not exists is_test boolean not null default false;
grant select (is_test) on public.shippers to authenticated;

create or replace function public.shippers_guard_owner_editable_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if not (old.user_id is not null and old.user_id = auth.uid()) then
    return old;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.contact_name := old.contact_name;
  new.contact_email := old.contact_email;
  new.contact_phone := old.contact_phone;
  new.fmc_oti_license_number := old.fmc_oti_license_number;
  new.status := old.status;
  new.payment_status := old.payment_status;
  new.terms_accepted_at := old.terms_accepted_at;
  new.terms_version := old.terms_version;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_payment_method_id := old.stripe_payment_method_id;
  new.card_on_file := old.card_on_file;
  new.reviewed_by := old.reviewed_by;
  new.rejection_reason := old.rejection_reason;
  new.reinstated_at := old.reinstated_at;
  new.is_test := old.is_test;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- Applicants could set is_test on their own INSERT (the signup policy only
-- checks status/payment_status/user_id); force it false unless admin.
create or replace function public.shippers_guard_insert_test_flag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    new.is_test := false;
  end if;
  return new;
end;
$$;

drop trigger if exists shippers_guard_insert_test_flag on public.shippers;
create trigger shippers_guard_insert_test_flag
  before insert on public.shippers
  for each row execute function public.shippers_guard_insert_test_flag();

-- The founder's test applications (2026-10-04), including two submitted
-- after the list was written (MOVATEST@#, MOVATEST@#5) and Test Shipping Co.
update public.shippers set is_test = true
where company_name in ('Test Shipping Co', 'test shipping', 'TESTSHIPPER3', 'the test', 'MOVATEST@#', 'MOVATEST@#5')
   or contact_email in ('tbakare2+shipper@gmail.com', 'tbakare2+shipper3@gmail.com', 'tbakare2+shipper4@gmail.com', 'tbakare2+shipper5@gmail.com');
