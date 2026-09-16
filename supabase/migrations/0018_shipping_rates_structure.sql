-- MOVA — structured shipper rates (destination x vehicle size x method) +
-- buyer-locked shipping selection on purchase_requests
--
-- BEFORE THIS MIGRATION: shipping_rates.vehicle_size_type existed but was
-- free-text and unused (the one live rate has it null) — effectively a flat
-- per-destination number. shipping_method already existed as a Postgres
-- enum (created in 0001_init.sql for the original Phase-0 scaffold, never
-- dropped when 0004 removed that scaffold's tables — matches the
-- `ShippingMethod = "roro" | "container"` TS type already declared with
-- nothing in the schema referencing it) but no column used it anywhere.
-- purchase_requests.shipping_rate_id existed too, but as a bare uuid with no
-- FK (deliberately left dangling per 0004's comment) and is never read or
-- written anywhere in app/ — it's the natural slot for "the rate the buyer
-- locked in for this reservation," now wired up for real. `vehicles` had no
-- size/body-type column at all.
--
-- SCOPE: this is the rates-structure + buyer-selection schema only. It does
-- NOT touch Stripe charge amounts, shipment_requests' commission fields, the
-- shipper-commission-charge flow (completeShipment), or shippers.payment_status
-- — explicitly decided against expanding MOVA into collecting/holding
-- shipping money. The buyer-facing "all-in total" is a display computation
-- app-side; requestFeePayment's Checkout session keeps exactly one line item
-- (the MOVA facilitation fee), unchanged.
--
-- SEQUENCING: destination + shipper/method selection is independent of price
-- negotiation — shipping cost depends only on destination/size/method, never
-- on vehicle price, so there's no calculation reason to order one before the
-- other. Enforcement of "required before Invoice 1" happens app-side in
-- requestFeePayment (the one real chokepoint that already re-snapshots
-- price/fee at that moment), not as a DB constraint — mirrors how every other
-- "must be true before this admin action" rule in that function already works
-- (bail conditions in app code, not table CHECKs).

-- 1. New structured dimensions -----------------------------------------------
create type vehicle_size_type as enum ('sedan', 'suv_truck');
-- shipping_method already exists — created in 0001_init.sql for the
-- original Phase-0 scaffold ('roro', 'container', exactly what's needed
-- here) and never dropped when 0004 removed that scaffold's tables.

-- 2. vehicles: seller-set size class, same as transmission/condition today —
-- no RLS/trigger change needed, the existing seller-write policy already
-- covers any plain column on the seller's own row.
alter table public.vehicles
  add column vehicle_size_type vehicle_size_type;

-- Backfill the one live listing (2003 Honda Accord — a sedan) before making
-- the column required for everything going forward.
update public.vehicles set vehicle_size_type = 'sedan' where vehicle_size_type is null;

alter table public.vehicles
  alter column vehicle_size_type set not null;

-- 3. shipping_rates: convert vehicle_size_type to the real enum, add
-- shipping_method, both required. The one live rate row (vehicle_size_type
-- null) doesn't fit the structured model — deactivated rather than guessed
-- at; the shipper re-adds it properly through the new rate-management UI.
update public.shipping_rates
set active = false, vehicle_size_type = 'sedan'
where vehicle_size_type is null;

-- shipper_rates_public selects vehicle_size_type directly, which blocks an
-- ALTER COLUMN TYPE while it exists — drop and recreate around it.
drop view public.shipper_rates_public;

alter table public.shipping_rates
  alter column vehicle_size_type type vehicle_size_type
  using vehicle_size_type::vehicle_size_type;

alter table public.shipping_rates
  alter column vehicle_size_type set not null,
  add column shipping_method shipping_method not null default 'roro';

alter table public.shipping_rates
  alter column shipping_method drop default;

-- One ACTIVE row per (shipper, destination, size, method) — partial index,
-- same convention as vehicle_photos_one_primary_per_vehicle (0002): a
-- shipper can "Hide" (active=false, the existing toggle) an old rate and add
-- a fresh active one for the same lane without first deleting the old row.
-- origin_region is deliberately NOT part of this key — it's shipper-entered
-- descriptive text, never used in any buyer-side matching query
-- (destination_country is the only geography filter applied anywhere in
-- app/), so two rows differing only in origin_region would be
-- indistinguishable to a buyer and just create ambiguity about which price
-- applies.
create unique index shipping_rates_shipper_destination_size_method_idx
  on public.shipping_rates (shipper_id, destination_country, vehicle_size_type, shipping_method)
  where active;

-- shipper_rates_public (0004) needs the new column surfaced to buyers.
create or replace view public.shipper_rates_public
with (security_invoker = true) as
select
  r.id as rate_id,
  r.shipper_id,
  s.company_name,
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

-- 4. purchase_requests.shipping_rate_id: give it a real FK (safe — the
-- column is always null today, confirmed unused anywhere in app/) and let
-- the buyer set/change it via the existing negotiation-guard trigger.
alter table public.purchase_requests
  add constraint purchase_requests_shipping_rate_id_fkey
  foreign key (shipping_rate_id) references public.shipping_rates(id);

create or replace function public.purchase_requests_guard_negotiation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if exists (
    select 1 from public.vehicles v
    where v.id = old.vehicle_id and v.seller_id = auth.uid()
  ) then
    if old.negotiated_price_status <> 'accepted'
       and new.negotiated_price_status = 'proposed'
       and new.negotiated_price_usd is not null
       and new.negotiated_price_usd > 0
       and new.negotiated_price_usd < coalesce(
             old.vehicle_price_usd,
             (select price_usd from public.vehicles where id = old.vehicle_id)
           )
       and old.status in ('submitted', 'under_review', 'verified')
    then
      new.negotiated_price_proposed_at := now();
      new.negotiated_price_accepted_at := old.negotiated_price_accepted_at;
    else
      -- Not a valid proposal (or reservation locked/closed) — revert the
      -- negotiation fields too, not just everything else below.
      new.negotiated_price_usd := old.negotiated_price_usd;
      new.negotiated_price_status := old.negotiated_price_status;
      new.negotiated_price_proposed_at := old.negotiated_price_proposed_at;
      new.negotiated_price_accepted_at := old.negotiated_price_accepted_at;
    end if;

    new.vehicle_id := old.vehicle_id;
    new.buyer_id := old.buyer_id;
    new.shipping_rate_id := old.shipping_rate_id;
    new.status := old.status;
    new.vehicle_price_usd := old.vehicle_price_usd;
    new.mova_fee_usd := old.mova_fee_usd;
    new.mova_fee_payment_status := old.mova_fee_payment_status;
    new.mova_fee_stripe_session_id := old.mova_fee_stripe_session_id;
    new.mova_fee_checkout_url := old.mova_fee_checkout_url;
    new.seller_details_revealed_at := old.seller_details_revealed_at;
    new.seller_name := old.seller_name;
    new.seller_email := old.seller_email;
    new.seller_phone := old.seller_phone;
    new.seller_whatsapp := old.seller_whatsapp;
    new.payment_method := old.payment_method;
    new.payment_reference := old.payment_reference;
    -- Bank-transfer fields: sellers have no legitimate path to any of these.
    new.bank_transfer_proof_path := old.bank_transfer_proof_path;
    new.bank_transfer_proof_uploaded_at := old.bank_transfer_proof_uploaded_at;
    new.bank_transfer_reviewed_by := old.bank_transfer_reviewed_by;
    new.bank_transfer_reviewed_at := old.bank_transfer_reviewed_at;
    new.bank_transfer_rejection_reason := old.bank_transfer_rejection_reason;
    new.notes := old.notes;
    new.assigned_admin_id := old.assigned_admin_id;
    new.created_at := old.created_at;
    return new;
  end if;

  if old.buyer_id = auth.uid() then
    if old.negotiated_price_status = 'proposed'
       and new.negotiated_price_status = 'accepted'
    then
      new.negotiated_price_accepted_at := now();
      new.negotiated_price_usd := old.negotiated_price_usd;
      new.negotiated_price_proposed_at := old.negotiated_price_proposed_at;
    else
      new.negotiated_price_status := old.negotiated_price_status;
      new.negotiated_price_usd := old.negotiated_price_usd;
      new.negotiated_price_proposed_at := old.negotiated_price_proposed_at;
      new.negotiated_price_accepted_at := old.negotiated_price_accepted_at;
    end if;

    -- Bank-transfer proof submission: the ONLY fee-payment-status transition
    -- a buyer can make is into 'pending_manual_verification', paired with
    -- payment_method = 'bank_transfer' and a freshly-set proof path. This is
    -- also the only path to 'paid' this function will ever be asked to
    -- gate away from — 'paid' itself never appears as an allowed new value
    -- below, from either starting state.
    if old.mova_fee_payment_status in ('pending', 'bank_transfer_rejected')
       and new.mova_fee_payment_status = 'pending_manual_verification'
       and new.payment_method = 'bank_transfer'
       and new.bank_transfer_proof_path is not null
       and new.bank_transfer_proof_path is distinct from old.bank_transfer_proof_path
    then
      new.bank_transfer_proof_uploaded_at := now();
      -- A fresh upload starts a fresh review cycle — clear any prior
      -- rejection rather than leaving stale admin fields on the row.
      new.bank_transfer_reviewed_by := null;
      new.bank_transfer_reviewed_at := null;
      new.bank_transfer_rejection_reason := null;
    else
      new.mova_fee_payment_status := old.mova_fee_payment_status;
      new.payment_method := old.payment_method;
      new.bank_transfer_proof_path := old.bank_transfer_proof_path;
      new.bank_transfer_proof_uploaded_at := old.bank_transfer_proof_uploaded_at;
      new.bank_transfer_reviewed_by := old.bank_transfer_reviewed_by;
      new.bank_transfer_reviewed_at := old.bank_transfer_reviewed_at;
      new.bank_transfer_rejection_reason := old.bank_transfer_rejection_reason;
    end if;

    -- Shipping selection: freely settable (including back to null) while
    -- Invoice 1 hasn't been generated yet, but only to an active rate whose
    -- vehicle_size_type matches this reservation's vehicle — enforced here,
    -- not just in the UI, same as the negotiated-price ceiling above. Once
    -- mova_fee_checkout_url exists the pick is locked, mirroring how an
    -- accepted negotiated price locks.
    if old.mova_fee_checkout_url is null
       and new.shipping_rate_id is distinct from old.shipping_rate_id
       and (
         new.shipping_rate_id is null
         or exists (
           select 1
           from public.shipping_rates sr
           join public.vehicles v on v.id = old.vehicle_id
           where sr.id = new.shipping_rate_id
             and sr.active
             and sr.vehicle_size_type = v.vehicle_size_type
         )
       )
    then
      null; -- keep new.shipping_rate_id as sent
    else
      new.shipping_rate_id := old.shipping_rate_id;
    end if;

    new.vehicle_id := old.vehicle_id;
    new.buyer_id := old.buyer_id;
    new.status := old.status;
    new.vehicle_price_usd := old.vehicle_price_usd;
    new.mova_fee_usd := old.mova_fee_usd;
    new.mova_fee_stripe_session_id := old.mova_fee_stripe_session_id;
    new.mova_fee_checkout_url := old.mova_fee_checkout_url;
    new.seller_details_revealed_at := old.seller_details_revealed_at;
    new.seller_name := old.seller_name;
    new.seller_email := old.seller_email;
    new.seller_phone := old.seller_phone;
    new.seller_whatsapp := old.seller_whatsapp;
    new.payment_reference := old.payment_reference;
    new.notes := old.notes;
    new.assigned_admin_id := old.assigned_admin_id;
    new.created_at := old.created_at;
    return new;
  end if;

  -- Neither this reservation's seller nor its buyer. The RLS row policies
  -- already scope UPDATE to those two (plus admin, handled above), so this
  -- shouldn't be reachable — but revert everything rather than trust that
  -- alone.
  return old;
end;
$$;
