-- 0062 — Escrow.com integration for the car and for shipping (build A).
--
-- Founder's decisions (2026-10-06): a second Escrow.com milestone
-- transaction per shipment, ShipMova as broker; inland portion released at
-- pickup, ocean freight at bill of lading; the buyer pays the second escrow
-- fee (its own line); 5-day auto-release (Escrow.com's inspection period);
-- live together with the car's escrow at launch. ShipMova never holds the
-- money: these columns only record what Escrow.com reports.
--
-- Nothing existing is replaced or dropped except the buyer-facing view
-- shipper_rates_public, re-created with one column appended (inland_price);
-- same rows, same security_invoker. New guard triggers are added alongside
-- the existing ones (those functions are not touched).

-- 1. The shipper's inland portion of each rate (the rest is ocean freight).
alter table public.shipping_rates
  add column if not exists inland_price numeric(12, 2);
alter table public.shipping_rates
  drop constraint if exists shipping_rates_inland_price_check;
alter table public.shipping_rates
  add constraint shipping_rates_inland_price_check
  check (inland_price is null or (inland_price > 0 and inland_price < price));

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
         s.coi_expires_on,
         r.inland_price
    from public.shipping_rates r
    join public.shippers s on s.id = r.shipper_id
   where r.active and public.shipper_is_bookable(s.id);

-- 2. Bill of lading as a shipment proof (releases the ocean milestone).
alter type public.shipment_proof_kind add value if not exists 'bill_of_lading';

-- 3. Shipping escrow on each shipment.
alter table public.shipment_requests
  add column if not exists inland_usd numeric(12, 2),
  add column if not exists ocean_usd numeric(12, 2),
  add column if not exists escrow_transaction_id text unique,
  add column if not exists escrow_inland_state text,
  add column if not exists escrow_ocean_state text,
  add column if not exists escrow_fee_usd numeric(12, 2),
  add column if not exists escrow_synced_at timestamptz;
alter table public.shipment_requests
  drop constraint if exists shipment_requests_escrow_states_check;
alter table public.shipment_requests
  add constraint shipment_requests_escrow_states_check check (
    coalesce(escrow_inland_state, 'awaiting_payment') in ('awaiting_payment', 'funded', 'marked_done', 'released', 'in_dispute', 'rejected', 'cancelled')
    and coalesce(escrow_ocean_state, 'awaiting_payment') in ('awaiting_payment', 'funded', 'marked_done', 'released', 'in_dispute', 'rejected', 'cancelled'));

-- The price and split always come from the shipper's rate, not from the
-- browser that inserts the row (the buyer-insert policy doesn't check them).
-- Escrow fields start empty unless the server or an admin writes them.
create or replace function public.shipment_requests_guard_escrow()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select price, inland_price into r from public.shipping_rates where id = new.shipping_rate_id;
    if not found then
      raise exception 'shipping_rate_not_found';
    end if;
    new.agreed_rate := r.price;
    new.inland_usd := r.inland_price;
    new.ocean_usd := case when r.inland_price is null then null else r.price - r.inland_price end;
    new.escrow_transaction_id := null;
    new.escrow_inland_state := null;
    new.escrow_ocean_state := null;
    new.escrow_fee_usd := null;
    new.escrow_synced_at := null;
    return new;
  end if;
  new.inland_usd := old.inland_usd;
  new.ocean_usd := old.ocean_usd;
  new.escrow_transaction_id := old.escrow_transaction_id;
  new.escrow_inland_state := old.escrow_inland_state;
  new.escrow_ocean_state := old.escrow_ocean_state;
  new.escrow_fee_usd := old.escrow_fee_usd;
  new.escrow_synced_at := old.escrow_synced_at;
  return new;
end;
$$;
drop trigger if exists shipment_requests_guard_escrow on public.shipment_requests;
create trigger shipment_requests_guard_escrow
  before insert or update on public.shipment_requests
  for each row execute function public.shipment_requests_guard_escrow();

-- 4. The car's escrow state (escrow_reference already holds Escrow.com's
-- transaction id; escrow_stage stays the staff-facing stage, 0055).
alter table public.purchase_requests
  add column if not exists escrow_car_state text,
  add column if not exists escrow_fee_usd numeric(12, 2),
  add column if not exists escrow_synced_at timestamptz;
alter table public.purchase_requests
  drop constraint if exists purchase_requests_escrow_car_state_check;
alter table public.purchase_requests
  add constraint purchase_requests_escrow_car_state_check check (
    coalesce(escrow_car_state, 'awaiting_payment') in ('awaiting_payment', 'funded', 'marked_done', 'released', 'in_dispute', 'rejected', 'cancelled'));

-- Buyers and sellers can't set any escrow field (insert or update). The
-- existing negotiation guard already pins escrow_reference/escrow_stage on
-- update; this also covers insert and the new columns.
create or replace function public.purchase_requests_guard_escrow()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.escrow_reference := null;
    new.escrow_stage := null;
    new.escrow_car_state := null;
    new.escrow_fee_usd := null;
    new.escrow_synced_at := null;
    return new;
  end if;
  new.escrow_reference := old.escrow_reference;
  new.escrow_stage := old.escrow_stage;
  new.escrow_car_state := old.escrow_car_state;
  new.escrow_fee_usd := old.escrow_fee_usd;
  new.escrow_synced_at := old.escrow_synced_at;
  return new;
end;
$$;
drop trigger if exists purchase_requests_guard_escrow on public.purchase_requests;
create trigger purchase_requests_guard_escrow
  before insert or update on public.purchase_requests
  for each row execute function public.purchase_requests_guard_escrow();

-- 5. Every Escrow.com webhook received (they aren't signed: each one only
-- triggers a re-fetch of the transaction from Escrow.com). Admin read only;
-- written by the server.
create table if not exists public.escrow_webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  transaction_id text,
  event_type text,
  result text check (char_length(result) <= 500),
  processed_at timestamptz
);
alter table public.escrow_webhook_events enable row level security;
drop policy if exists "escrow webhook events admin read" on public.escrow_webhook_events;
create policy "escrow webhook events admin read" on public.escrow_webhook_events
  for select using (public.is_admin());
revoke all on public.escrow_webhook_events from anon, authenticated;
grant select on public.escrow_webhook_events to authenticated;
