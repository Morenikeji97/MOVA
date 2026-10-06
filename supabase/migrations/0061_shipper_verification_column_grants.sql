-- 0061 — read access to the columns 0060 added to public.shippers.
--
-- public.shippers grants SELECT column by column (0004 hardening:
-- "shippers_minimal_public_columns"), and 0060 didn't add its new columns to
-- those grants. Since 0060 every query naming them is refused — including
-- the buyer-facing view shipper_rates_public (security_invoker) and the
-- shipper portal. Rows are still limited by RLS (bookable shippers for
-- everyone; owner and admin otherwise); this only says which columns of a
-- visible row may be read.
--
-- Signed-out visitors: what the "Insured ✓" badge and the rates list show.
grant select (coi_status, coi_expires_on, coi_cargo_limit_usd, license_status)
  on public.shippers to anon;
-- Signed-in users (the shipper's portal; the admin page): also insurer,
-- review note and dates, and the certificate's storage path (useless without
-- the bucket, which has no read rule).
grant select (coi_status, coi_expires_on, coi_cargo_limit_usd, license_status,
              coi_insurer, coi_review_note, coi_reviewed_at, coi_document_path,
              license_checked_at)
  on public.shippers to authenticated;
-- Deliberately not granted (server / service role only): coi_reviewed_by,
-- license_checked_by, coi_submitted_at, coi_reminder_stage.
