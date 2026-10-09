-- Rollback for 0061: removes the read grants it added (nothing else changes).
revoke select (coi_status, coi_expires_on, coi_cargo_limit_usd, license_status)
  on public.shippers from anon;
revoke select (coi_status, coi_expires_on, coi_cargo_limit_usd, license_status,
               coi_insurer, coi_review_note, coi_reviewed_at, coi_document_path,
               license_checked_at)
  on public.shippers from authenticated;
