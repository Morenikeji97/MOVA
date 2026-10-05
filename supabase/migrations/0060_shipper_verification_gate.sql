-- 0060 — shipper verification gate (Day 3).
--
-- A shipper is shown to buyers and bookable only when ALL of these hold:
--   - approved by ShipMova and not suspended (as before);
--   - marine-cargo insurance certificate (COI) approved by ShipMova and not
--     expired (coi_expires_on >= today) — expiry hides them automatically,
--     no job needed;
--   - FMC/OTI license checked active on the FMC's OTI list by an admin.
-- Approval itself also requires the COI and license checks (trigger below).
--
-- All new columns are written only by ShipMova's server (service role) or an
-- admin: the shipper uploads the certificate into a private bucket and a
-- server action records it. The owner guard pins every new column.
--
-- What this changes that already exists (nothing is deleted):
--   - shippers_guard_owner_editable_fields(): replaced with the live body
--     (2026-10-05) plus pins for the new columns.
--   - policy "shippers approved public read" and "shipping rates public
--     active read" are dropped and re-created with the extra conditions
--     (via shipper_is_bookable()); view shipper_rates_public gets the same
--     condition and two appended columns (cover limit, expiry date). Effect: approved shippers without an
--     approved, unexpired COI and checked license stop being shown publicly —
--     today that is only "Test Shipping Co" (a test shipper).
-- Rollback: supabase/rollback/0060_shipper_verification_gate.rollback.sql.

alter table public.shippers
  add column if not exists coi_status text not null default 'none'
    check (coi_status in ('none', 'pending', 'approved', 'rejected')),
  add column if not exists coi_document_path text,
  add column if not exists coi_insurer text check (char_length(coi_insurer) <= 200),
  add column if not exists coi_cargo_limit_usd numeric(12, 2) check (coi_cargo_limit_usd > 0),
  add column if not exists coi_expires_on date,
  add column if not exists coi_submitted_at timestamptz,
  add column if not exists coi_reviewed_by uuid,
  add column if not exists coi_reviewed_at timestamptz,
  add column if not exists coi_review_note text check (char_length(coi_review_note) <= 1000),
  -- Last expiry reminder sent for the current certificate: '30d', '7d', 'expired'.
  add column if not exists coi_reminder_stage text check (coi_reminder_stage in ('30d', '7d', 'expired')),
  add column if not exists license_status text not null default 'unchecked'
    check (license_status in ('unchecked', 'active', 'not_found')),
  add column if not exists license_checked_by uuid,
  add column if not exists license_checked_at timestamptz;

-- Owner guard: the live body plus the new columns.
create or replace function public.shippers_guard_owner_editable_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $$
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
  new.coi_status := old.coi_status;
  new.coi_document_path := old.coi_document_path;
  new.coi_insurer := old.coi_insurer;
  new.coi_cargo_limit_usd := old.coi_cargo_limit_usd;
  new.coi_expires_on := old.coi_expires_on;
  new.coi_submitted_at := old.coi_submitted_at;
  new.coi_reviewed_by := old.coi_reviewed_by;
  new.coi_reviewed_at := old.coi_reviewed_at;
  new.coi_review_note := old.coi_review_note;
  new.coi_reminder_stage := old.coi_reminder_stage;
  new.license_status := old.license_status;
  new.license_checked_by := old.license_checked_by;
  new.license_checked_at := old.license_checked_at;
  return new;
end;
$$;

-- New applications start unverified whoever inserts them (the signup insert
-- policy lets anyone apply).
create or replace function public.shippers_guard_insert_verification()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.coi_status := 'none';
  new.coi_document_path := null; new.coi_insurer := null; new.coi_cargo_limit_usd := null;
  new.coi_expires_on := null; new.coi_submitted_at := null; new.coi_reviewed_by := null;
  new.coi_reviewed_at := null; new.coi_review_note := null; new.coi_reminder_stage := null;
  new.license_status := 'unchecked'; new.license_checked_by := null; new.license_checked_at := null;
  return new;
end;
$$;
drop trigger if exists shippers_guard_insert_verification on public.shippers;
create trigger shippers_guard_insert_verification
  before insert on public.shippers
  for each row execute function public.shippers_guard_insert_verification();

-- Approval requires an approved, unexpired COI and a checked license — for
-- everyone, admins included.
create or replace function public.shippers_require_verification_to_approve()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.coi_status <> 'approved' or new.coi_expires_on is null or new.coi_expires_on < current_date then
      raise exception 'shipper_coi_required' using hint = 'Approve an unexpired marine-cargo insurance certificate first.';
    end if;
    if new.license_status <> 'active' then
      raise exception 'shipper_license_required' using hint = 'Check the FMC/OTI license on the FMC list first.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists shippers_require_verification_to_approve on public.shippers;
create trigger shippers_require_verification_to_approve
  before update on public.shippers
  for each row execute function public.shippers_require_verification_to_approve();

-- One definition of "shown to buyers and bookable".
create or replace function public.shipper_is_bookable(p_shipper_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shippers s
    where s.id = p_shipper_id
      and s.status = 'approved'
      and s.payment_status <> 'suspended'
      and s.coi_status = 'approved'
      and s.coi_expires_on >= current_date
      and s.license_status = 'active'
  );
$$;
grant execute on function public.shipper_is_bookable(uuid) to anon, authenticated;

drop policy if exists "shippers approved public read" on public.shippers;
create policy "shippers approved public read" on public.shippers
  for select using (public.shipper_is_bookable(id));

drop policy if exists "shipping rates public active read" on public.shipping_rates;
create policy "shipping rates public active read" on public.shipping_rates
  for select using (active and public.shipper_is_bookable(shipper_id));

-- The buyer-facing rate list: same "bookable" rule even for admins and the
-- shipper themselves, plus what the "Insured ✓" badge shows. Columns are only
-- appended (create or replace view keeps the existing ones in order);
-- security_invoker stays on.
create or replace view public.shipper_rates_public with (security_invoker = true) as
  select r.id as rate_id,
         r.shipper_id,
         s.company_name,
         s.service_areas,
         r.origin_region,
         r.origin_port,
         r.destination_country,
         r.vehicle_size_type,
         r.shipping_method,
         r.price,
         r.currency,
         s.payment_status,
         s.coi_cargo_limit_usd,
         s.coi_expires_on
    from public.shipping_rates r
    join public.shippers s on s.id = r.shipper_id
   where r.active and public.shipper_is_bookable(s.id);

-- Private bucket for insurance certificates (PDF or photo). No read rule for
-- anyone: admins see them through a short-lived link from the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipper-insurance-documents', 'shipper-insurance-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "shipper insurance owner insert" on storage.objects;
create policy "shipper insurance owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shipper-insurance-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "shipper insurance owner delete" on storage.objects;
create policy "shipper insurance owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shipper-insurance-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Daily insurance-expiry check (reminders at 30 and 7 days, and on expiry).
select cron.schedule(
  'shipper-insurance-expiry',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://shipmova.com/api/cron/shipper-insurance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
