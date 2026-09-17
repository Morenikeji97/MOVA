-- MOVA — Abandoned-reservation auto-release: schema
--
-- A buyer can stall indefinitely at the fee-payment step (never pays by card,
-- never uploads bank-transfer proof) while their reservation sits open. This
-- adds the one new column the timeout needs and locks it down the same way
-- every other admin-only field on this table already is.
--
-- CLOCK ANCHOR: fee_payment_requested_at, not created_at. The fee invoice
-- isn't sent until an admin calls requestFeePayment (app/admin/reservations/
-- actions.ts) — which can happen well after the buyer's original reservation
-- — so anchoring the 24h window on created_at would auto-expire reservations
-- still sitting untouched in the admin review queue, before the buyer was
-- ever shown a way to pay. fee_payment_requested_at is set once, the first
-- time an invoice is generated (see Step 5 of the feature — requestFeePayment
-- is updated separately in app code, not here); it is never reset by
-- regenerating a lapsed Stripe Checkout link, so the deadline can't be
-- pushed out indefinitely by re-clicking "Regenerate fee link".
--
-- The actual timeout rule (including the bank-transfer pause and the
-- bank_transfer_rejected restart) lives in lib/auto-release.ts, not in SQL —
-- see that file for the full rule. This migration only adds the column and
-- protects it.

alter table public.purchase_requests
  add column fee_payment_requested_at timestamptz;

-- Extend the column-level guard (same idiom as every migration since 0011:
-- buyer/seller writes revert every admin-only field to its old value).
-- fee_payment_requested_at joins the other admin-only fields
-- (mova_fee_checkout_url, seller_details_revealed_at, etc.) in both the
-- seller and buyer branches below — copied verbatim from 0018's version with
-- just that one addition in each branch.
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
    new.fee_payment_requested_at := old.fee_payment_requested_at;
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
    new.fee_payment_requested_at := old.fee_payment_requested_at;
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
