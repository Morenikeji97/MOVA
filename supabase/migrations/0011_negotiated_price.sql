-- MOVA — Seller-negotiated reservation price
--
-- Sellers negotiate with buyers in chat and need to offer a lower final price
-- than the public listing without touching the listing itself. This adds a
-- per-reservation negotiated price to purchase_requests, buyer-gated so it
-- never takes effect silently.
--
-- public.vehicles.price_usd is never written by this migration or the code
-- that uses it — the public listing price stays fixed. A negotiated price
-- lives only on the one purchase_requests row it was proposed against; if the
-- buyer never accepts and the reservation is released/cancelled, the next
-- buyer's reservation is a fresh row starting at negotiated_price_status =
-- 'none', so the listing is effectively back at its original price with no
-- extra bookkeeping needed.
--
-- RLS SHAPE: same pattern as the vehicles/seller_profiles fixes in
-- 0009/0010. USING/WITH CHECK on an UPDATE policy can only gate *which row*
-- is touched, not *which columns* change, so:
--   - two new UPDATE policies grant row-level access (seller on their own
--     reservation's vehicle; buyer on their own reservation) — deliberately
--     broad at the row level, with no column restriction in the policy itself
--   - a BEFORE UPDATE trigger is the actual column-level enforcement: it
--     reverts any column a non-admin/non-service-role actor isn't allowed to
--     touch back to its old value, and validates the one transition each side
--     is allowed to make
--
-- Seller: may only set negotiated_price_status -> 'proposed' together with a
-- negotiated_price_usd that is > 0 and strictly less than the reservation's
-- price snapshot (vehicle_price_usd) — lower-only, enforced in the database,
-- not just the form — and only while the reservation is still open
-- ('submitted'/'under_review'/'verified') and not already accepted. Every
-- other column reverts, including negotiated_price_status set to anything
-- other than 'proposed'.
--
-- Buyer: may only flip 'proposed' -> 'accepted'. Cannot author
-- negotiated_price_usd themselves (reverted to old value) and cannot accept
-- out of 'none' (nothing to accept). Every other column reverts.
--
-- Once accepted, negotiated_price_status = 'accepted' is locked — the guard
-- only recognizes the seller's 'proposed' transition when the old status is
-- not already 'accepted', so a further seller update reverts the negotiation
-- fields to their accepted values.

create type negotiated_price_status as enum ('none', 'proposed', 'accepted');

alter table public.purchase_requests
  add column negotiated_price_usd numeric(12,2),
  add column negotiated_price_status negotiated_price_status not null default 'none',
  add column negotiated_price_proposed_at timestamptz,
  add column negotiated_price_accepted_at timestamptz;

-- A lower-only guard even for admin/service-role writes would be one edit
-- away from the constraint below being wrong for a legitimate correction, so
-- this stays a trigger-time check for non-privileged actors only (see the
-- function), not a table CHECK constraint.

create or replace function public.purchase_requests_guard_negotiation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_seller boolean;
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  v_is_seller := exists (
    select 1 from public.vehicles v
    where v.id = old.vehicle_id and v.seller_id = auth.uid()
  );

  if v_is_seller then
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
    new.notes := old.notes;
    new.assigned_admin_id := old.assigned_admin_id;
    new.created_at := old.created_at;
    return new;
  end if;

  -- Neither this reservation's seller nor its buyer. The RLS row policies
  -- below already scope UPDATE to those two (plus admin, handled above), so
  -- this shouldn't be reachable — but revert everything rather than trust
  -- that alone.
  return old;
end;
$$;

create trigger purchase_requests_guard_negotiation
  before update on public.purchase_requests
  for each row execute procedure public.purchase_requests_guard_negotiation();

revoke execute on function public.purchase_requests_guard_negotiation()
  from public, anon, authenticated;

-- Row-level access. Column-level enforcement is entirely the trigger above —
-- these intentionally don't try to restrict columns themselves.
create policy "purchase requests seller propose price" on public.purchase_requests
  for update
  using (
    exists (select 1 from public.vehicles v
      where v.id = purchase_requests.vehicle_id and v.seller_id = auth.uid())
  )
  with check (
    exists (select 1 from public.vehicles v
      where v.id = purchase_requests.vehicle_id and v.seller_id = auth.uid())
  );

create policy "purchase requests buyer accept price" on public.purchase_requests
  for update
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());
