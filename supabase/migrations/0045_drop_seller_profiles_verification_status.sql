-- MOVA — drop seller_profiles.verification_status (never used).
--
-- Seller verification is id_verification_status (Stripe Identity). This
-- older column was only ever touched by seller_profiles_guard_admin_only_fields,
-- which forced it to 'unverified' on insert and froze it on update — nothing
-- in the app, RLS, views or other functions read it. Both rows held
-- 'unverified' when this was written.
--
-- Not to be confused with buyer_profiles.verification_status (buyer KYC —
-- used, kept) or vehicles.verification_status (kept for now).
--
-- The guard must lose its two references in the same transaction as the
-- drop, or it would fail on every seller_profiles write.

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
    new.id_verified_at := null;
    new.full_name := null;
    if new.id_verification_status <> 'pending' then
      new.id_verification_status := 'unverified';
    end if;
    return new;
  end if;

  new.id_verified_at := old.id_verified_at;
  new.full_name := old.full_name;
  if new.id_verification_status <> 'pending' then
    new.id_verification_status := old.id_verification_status;
  end if;
  return new;
end;
$$;

alter table public.seller_profiles drop column verification_status;
