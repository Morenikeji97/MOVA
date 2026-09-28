-- MOVA — remove the direct-wire flow's data ("Invoice 2").
--
-- Until now, paying MOVA's fee "revealed" the seller: the Stripe payments
-- webhook (and the admin bank-transfer confirmation) copied the seller's
-- name, email, phone and WhatsApp onto the reservation and stamped
-- seller_details_revealed_at, and the buyer dashboard showed them next to
-- "Wire to seller: $X" so the buyer could pay the seller directly. The car
-- price now goes through Escrow.com, and paying the fee no longer reveals
-- anything, so the snapshot columns go.
--
-- Apply only AFTER the app build that stops reading these columns is
-- deployed — the previous build selects them on the buyer dashboard.
-- 0039 already moved vehicle_vin and the review policy off
-- seller_details_revealed_at.
--
-- At the time of writing all three purchase_requests rows belong to MOVA's
-- own test accounts (2 rows had seller_details_revealed_at, 2 had
-- seller_email, none had the other three).

-- 1. The guard trigger, without the dropped columns ------------------------
-- Identical to the live version except the five
-- `new.<col> := old.<col>` lines for the dropped columns are gone (twice:
-- the seller branch and the buyer branch). It must change in the same
-- transaction as the drop, or it would fail on every update.
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
    new.payment_method := old.payment_method;
    new.payment_reference := old.payment_reference;
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

    if old.mova_fee_payment_status in ('pending', 'bank_transfer_rejected')
       and new.mova_fee_payment_status = 'pending_manual_verification'
       and new.payment_method = 'bank_transfer'
       and new.bank_transfer_proof_path is not null
       and new.bank_transfer_proof_path is distinct from old.bank_transfer_proof_path
    then
      new.bank_transfer_proof_uploaded_at := now();
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
      null;
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
    new.payment_reference := old.payment_reference;
    new.notes := old.notes;
    new.assigned_admin_id := old.assigned_admin_id;
    new.created_at := old.created_at;
    return new;
  end if;

  return old;
end;
$$;

-- 2. The columns -----------------------------------------------------------
alter table public.purchase_requests
  drop column seller_details_revealed_at,
  drop column seller_name,
  drop column seller_email,
  drop column seller_phone,
  drop column seller_whatsapp;
