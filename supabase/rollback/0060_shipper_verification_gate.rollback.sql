-- Rollback for 0060_shipper_verification_gate.sql — restores the database as
-- it was on 2026-10-05 before 0060 (definitions read from production that day).
-- Run as the database owner in one transaction. Dropping the coi_* / license_*
-- columns loses any insurance and license checks recorded after 0060: export
-- them first if any real shipper has been checked. Empty the
-- shipper-insurance-documents bucket through the Storage API before step 4.

begin;

-- 1. The owner guard, exactly as before 0060.
create or replace function public.shippers_guard_owner_editable_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
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
$function$;

-- 2. The two public read rules, exactly as before 0060.
drop policy if exists "shippers approved public read" on public.shippers;
create policy "shippers approved public read" on public.shippers
  for select using ((status = 'approved'::shipper_status) and (payment_status <> 'suspended'::shipper_payment_status));

drop policy if exists "shipping rates public active read" on public.shipping_rates;
create policy "shipping rates public active read" on public.shipping_rates
  for select using (active and exists (
    select 1 from public.shippers s
    where s.id = shipping_rates.shipper_id
      and s.status = 'approved'::shipper_status
      and s.payment_status <> 'suspended'::shipper_payment_status));

-- The view, exactly as before 0060 (dropped and re-created because 0060
-- appended columns).
drop view if exists public.shipper_rates_public;
create view public.shipper_rates_public with (security_invoker = true) as
  select r.id as rate_id, r.shipper_id, s.company_name, s.service_areas, r.origin_region,
         r.origin_port, r.destination_country, r.vehicle_size_type, r.shipping_method,
         r.price, r.currency, s.payment_status
    from public.shipping_rates r join public.shippers s on s.id = r.shipper_id
   where r.active and s.status = 'approved'::shipper_status
     and s.payment_status <> 'suspended'::shipper_payment_status;
grant all on public.shipper_rates_public to anon, authenticated, service_role;

-- 3. What 0060 added.
select cron.unschedule('shipper-insurance-expiry');
drop trigger if exists shippers_guard_insert_verification on public.shippers;
drop trigger if exists shippers_require_verification_to_approve on public.shippers;
drop function if exists public.shippers_guard_insert_verification();
drop function if exists public.shippers_require_verification_to_approve();
drop function if exists public.shipper_is_bookable(uuid);
drop policy if exists "shipper insurance owner insert" on storage.objects;
drop policy if exists "shipper insurance owner delete" on storage.objects;

-- 4. The bucket (must be empty) and the columns.
delete from storage.buckets where id = 'shipper-insurance-documents';
alter table public.shippers
  drop column if exists coi_status,
  drop column if exists coi_document_path,
  drop column if exists coi_insurer,
  drop column if exists coi_cargo_limit_usd,
  drop column if exists coi_expires_on,
  drop column if exists coi_submitted_at,
  drop column if exists coi_reviewed_by,
  drop column if exists coi_reviewed_at,
  drop column if exists coi_review_note,
  drop column if exists coi_reminder_stage,
  drop column if exists license_status,
  drop column if exists license_checked_by,
  drop column if exists license_checked_at;

commit;
