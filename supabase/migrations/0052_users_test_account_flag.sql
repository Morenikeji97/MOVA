-- Test accounts: marked so admin counts and metrics can leave them out.
--
-- Production and every deploy preview share one database, so test accounts
-- (e.g. the e2e WebKit test seller, docs/LAUNCH-BLOCKERS.md) live next to
-- real ones. `is_test_account` marks them; the admin dashboard excludes
-- their users, listings, reservations and shipments from its counts.
--
-- Admin-only, like role and status: the "users update own" RLS policy
-- doesn't restrict columns, so the guard trigger pins the flag for everyone
-- else (the owner-write gap pattern, migration 0010). The function body is
-- 0051's (live + referral columns) plus the new flag. Set it with:
--   update public.users set is_test_account = true where email = '…';
-- as an admin session or the service role.

alter table public.users add column is_test_account boolean not null default false;

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

update public.users set is_test_account = true
where email = 'tbakare2+e2e-webkit@gmail.com';
