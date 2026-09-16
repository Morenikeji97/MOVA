-- MOVA — snapshot vehicle info onto shipment_requests
--
-- The shipper dashboard needs the vehicle's make/model/year and pickup
-- location per shipment. Joining through purchase_request_id -> vehicles
-- would need a new shipper-read policy on purchase_requests — but that row
-- carries the seller's revealed contact info, payment_method/reference,
-- negotiated price, and admin notes, none of which are column-restricted
-- (unlike shippers' Stripe token columns), so a row-level grant there would
-- hand a shipper far more than a vehicle description. Snapshotting instead
-- follows the same pattern already used for shipper_*/buyer_* contact: no
-- new cross-table read policy needed at all.

alter table public.shipment_requests
  add column vehicle_year integer,
  add column vehicle_make text,
  add column vehicle_model text,
  add column vehicle_trim text,
  add column pickup_city text,
  add column pickup_state text;

-- Backfill this project's one existing row. Runs after the 0016 guard
-- trigger already exists, so it needs to identify as service_role —
-- otherwise the trigger (correctly) treats it as an unrecognized actor and
-- silently reverts the update, same as it would for any other untrusted
-- write. (Confirmed by hitting exactly this while applying the migration:
-- a plain UPDATE with no JWT claims set came back reverted.)
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

update public.shipment_requests sr
set
  vehicle_year = v.year,
  vehicle_make = v.make,
  vehicle_model = v.model,
  vehicle_trim = v.trim,
  pickup_city = v.location_city,
  pickup_state = v.location_state
from public.purchase_requests pr
join public.vehicles v on v.id = pr.vehicle_id
where pr.id = sr.purchase_request_id
  and sr.vehicle_make is null;

-- Extend the 0016 shipper-owner guard to also revert these new columns —
-- CREATE OR REPLACE on the same function, same trigger already attached.
create or replace function public.shipment_requests_guard_shipping_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if not exists (
    select 1 from public.shippers s
    where s.id = old.shipper_id and s.user_id = auth.uid()
  ) then
    return old;
  end if;

  new.shipping_status_updated_at :=
    case when new.shipping_status is distinct from old.shipping_status
         then now()
         else old.shipping_status_updated_at
    end;

  new.shipper_id := old.shipper_id;
  new.shipping_rate_id := old.shipping_rate_id;
  new.buyer_id := old.buyer_id;
  new.purchase_request_id := old.purchase_request_id;
  new.agreed_rate := old.agreed_rate;
  new.currency := old.currency;
  new.commission_pct := old.commission_pct;
  new.commission_owed := old.commission_owed;
  new.commission_charge_status := old.commission_charge_status;
  new.stripe_charge_id := old.stripe_charge_id;
  new.status := old.status;
  new.shipper_details_revealed_at := old.shipper_details_revealed_at;
  new.shipper_company_name := old.shipper_company_name;
  new.shipper_contact_name := old.shipper_contact_name;
  new.shipper_contact_email := old.shipper_contact_email;
  new.shipper_contact_phone := old.shipper_contact_phone;
  new.buyer_details_revealed_at := old.buyer_details_revealed_at;
  new.buyer_name := old.buyer_name;
  new.buyer_email := old.buyer_email;
  new.buyer_phone := old.buyer_phone;
  new.buyer_whatsapp := old.buyer_whatsapp;
  new.vehicle_year := old.vehicle_year;
  new.vehicle_make := old.vehicle_make;
  new.vehicle_model := old.vehicle_model;
  new.vehicle_trim := old.vehicle_trim;
  new.pickup_city := old.pickup_city;
  new.pickup_state := old.pickup_state;
  new.created_at := old.created_at;
  return new;
end;
$$;
