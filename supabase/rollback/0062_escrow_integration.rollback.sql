-- Rollback for 0062_escrow_integration.sql (database owner, one transaction).
-- Dropping the columns loses any Escrow.com transaction ids and states
-- recorded after 0062: export them first if a real deal has escrow open.
-- 'bill_of_lading' can't be removed from the enum once added (Postgres has
-- no "drop value"); delete any bill_of_lading proof rows if needed — the
-- value itself is harmless.
begin;

drop table if exists public.escrow_webhook_events;

drop trigger if exists purchase_requests_guard_escrow on public.purchase_requests;
drop function if exists public.purchase_requests_guard_escrow();
alter table public.purchase_requests
  drop constraint if exists purchase_requests_escrow_car_state_check,
  drop column if exists escrow_car_state,
  drop column if exists escrow_fee_usd,
  drop column if exists escrow_synced_at;

drop trigger if exists shipment_requests_guard_escrow on public.shipment_requests;
drop function if exists public.shipment_requests_guard_escrow();
alter table public.shipment_requests
  drop constraint if exists shipment_requests_escrow_states_check,
  drop column if exists inland_usd,
  drop column if exists ocean_usd,
  drop column if exists escrow_transaction_id,
  drop column if exists escrow_inland_state,
  drop column if exists escrow_ocean_state,
  drop column if exists escrow_fee_usd,
  drop column if exists escrow_synced_at;

-- The view as 0060 left it (re-created: 0062 appended inland_price).
drop view if exists public.shipper_rates_public;
create view public.shipper_rates_public with (security_invoker = true) as
  select r.id as rate_id, r.shipper_id, s.company_name, s.service_areas, r.origin_region,
         r.origin_port, r.destination_country, r.vehicle_size_type, r.shipping_method,
         r.price, r.currency, s.payment_status, s.coi_cargo_limit_usd, s.coi_expires_on
    from public.shipping_rates r join public.shippers s on s.id = r.shipper_id
   where r.active and public.shipper_is_bookable(s.id);
grant all on public.shipper_rates_public to anon, authenticated, service_role;

alter table public.shipping_rates
  drop constraint if exists shipping_rates_inland_price_check,
  drop column if exists inland_price;

commit;
