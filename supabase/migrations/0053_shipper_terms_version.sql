-- Which shipper terms each shipper accepted.
--
-- 2026-10-04: no shipper fees at launch ("No fees for founding partners").
-- Shipper terms move from v1 (8% commission on completed shipments, card kept
-- on file) to v2 (no fees; any future fee only under new terms the shipper
-- accepts). lib/shipping.ts holds SHIPPER_TERMS_VERSION and
-- SHIPPER_COMMISSION_PCT (now 0).
--
-- Existing shippers signed v1. New signups record v2.
--
-- Owners can't edit it: shippers_guard_owner_editable_fields() is the live
-- body (0016) plus terms_version.

alter table public.shippers add column if not exists terms_version text;

update public.shippers set terms_version = 'v1'
where terms_version is null and terms_accepted_at is not null;

grant select (terms_version) on public.shippers to anon, authenticated;

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

  -- Editable by the owning shipper: company_name, service_countries,
  -- service_areas, description. Everything else reverts.
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
  new.created_at := old.created_at;
  return new;
end;
$$;
