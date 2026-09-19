-- MOVA — Shipper pickup service areas (US states) + vehicle-state-aware
-- shipper ranking on the buyer-facing shipping marketplace.
--
-- Distinct axis from shippers.service_countries (the international
-- destination side, NG/GH/TG/BJ) — service_areas is the domestic pickup
-- side: which US states a shipper collects vehicles from. Same granularity
-- as vehicles.location_state (2-letter USPS state code — see
-- app/seller/listings/new/page.tsx's location_state field and the shared
-- list now extracted to lib/us-states.ts), so a straight array-membership
-- check is enough to flag a match; no separate lookup/join table needed
-- since a shipper's area list is small and never queried independently of
-- its own row.
--
-- Ranking only — this migration adds no CHECK/RLS that hides a non-local
-- shipper from a buyer. See lib/shipping.ts's compareRatesForBuyer (added
-- vehicleState sort key) and app/browse/[id]/shipping-rates.tsx's
-- "Local pickup" badge for where the surfacing actually happens.

alter table public.shippers
  add column service_areas text[] not null default '{}';

-- Ownership: reuses the existing "shippers owner update" RLS policy (0016:
-- `using/with check (user_id = auth.uid())`), which scopes by ROW, not
-- column — a shipper cannot even select another shipper's row as the
-- target of an UPDATE, so there is no column-level bypass to guard against
-- here. shippers_guard_owner_editable_fields() (0016) only reverts the
-- specific admin/system columns it lists (contact info, status, Stripe
-- tokens, etc.); anything it doesn't mention — company_name,
-- service_countries, description, and now service_areas — passes through
-- as NEW untouched, i.e. is owner-editable by construction. No trigger
-- change needed.

-- Column grant: publicly readable, same list every other non-sensitive
-- shippers column is already on, so buyer-side ranking can read it
-- directly without a second round trip.
revoke select on public.shippers from anon, authenticated;
grant select (
  id, user_id, company_name, contact_name, contact_email, contact_phone,
  fmc_oti_license_number, service_countries, service_areas, status,
  payment_status, terms_accepted_at, card_on_file, reviewed_by,
  rejection_reason, reinstated_at, description, created_at
) on public.shippers to anon, authenticated;

-- shipper_rates_public: surface service_areas so the buyer-facing query in
-- app/browse/[id]/page.tsx can rank/flag local shippers without a second
-- query against public.shippers. security_invoker => base-table RLS + the
-- column grant above both still apply.
drop view public.shipper_rates_public;

create view public.shipper_rates_public
with (security_invoker = true) as
select
  r.id as rate_id,
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
  s.payment_status
from public.shipping_rates r
join public.shippers s on s.id = r.shipper_id
where r.active
  and s.status = 'approved'
  and s.payment_status <> 'suspended';

grant select on public.shipper_rates_public to anon, authenticated;
