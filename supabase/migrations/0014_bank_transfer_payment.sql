-- MOVA — Bank-transfer fallback for the buyer's MOVA service fee
--
-- Alongside the existing Stripe Checkout ("card") path, a buyer whose card
-- can't complete an international payment can instead wire the fee and
-- upload proof of the transfer for an admin to manually confirm.
--
-- STATUS MODELING: this does NOT touch purchase_requests.status (the
-- reservation lifecycle — submitted/under_review/verified/…). It extends
-- mova_fee_payment_status instead, since that's the column every existing
-- seller-detail-reveal check already gates on ('paid'). Bank transfer is
-- just another path to 'paid':
--
--   pending -> pending_manual_verification -> paid
--                                          \-> bank_transfer_rejected -> (buyer retries) -> pending_manual_verification
--
-- REFERENCE CODE: shown to the buyer and admin, derived deterministically
-- from purchase_requests.id (see lib/bank-transfer.ts). Deliberately not
-- stored anywhere — a derived value can't drift out of sync with the row it
-- identifies.
--
-- COLUMN-LEVEL GUARD: same idiom as 0010/0011/0013 — RLS UPDATE policies
-- stay row-level only ("purchase requests buyer accept price" /
-- "purchase requests admin update", both already in place), and
-- purchase_requests_guard_negotiation (0011) is extended in place (not a
-- second trigger — see below for why) to be the actual column-level
-- enforcement:
--   - buyer: the ONLY transition permitted is
--     mova_fee_payment_status pending|bank_transfer_rejected -> pending_manual_verification,
--     together with payment_method = 'bank_transfer' and a newly-set
--     bank_transfer_proof_path. 'paid' is never a reachable target for a
--     buyer write, including a direct crafted PATCH. Admin-only review
--     fields (reviewed_by/reviewed_at/rejection_reason) can't be set by the
--     buyer to anything — the happy path clears them to null (a fresh
--     upload starts a fresh review cycle), any other attempt reverts them.
--   - seller: no legitimate path at all; all bank-transfer columns revert.
--   - admin/service-role: unchanged, bypasses the guard entirely (already
--     true today) — app code (app/admin/reservations/actions.ts) does the
--     actual confirm/reject business logic, same trust level as every other
--     admin action in this codebase.
--
-- Extending the existing trigger function (rather than adding a second
-- BEFORE UPDATE trigger) avoids execution-order fights: multiple triggers on
-- the same table run in name order, each seeing the previous one's NEW, and
-- 0011's trigger already unconditionally reverts mova_fee_payment_status /
-- payment_method for buyer writes — a separate later-running trigger
-- couldn't safely set them without knowing whether it runs before or after.
--
-- STORAGE: bank-transfer-proofs is a PRIVATE bucket (unlike vehicle-photos /
-- vehicle-videos) — this is a financial document, not listing media. Object
-- key convention: <buyer uid>/<purchase_request_id>/<uuid>.<ext>. Proof is
-- treated as evidence once uploaded: no UPDATE/DELETE policy for anyone
-- (same philosophy as policy_acceptances — nothing in the app can alter or
-- remove a submitted proof).

-- 1. mova_fee_payment_status: new states ------------------------------------
alter type mova_fee_payment_status add value 'pending_manual_verification';
alter type mova_fee_payment_status add value 'bank_transfer_rejected';

-- 2. purchase_requests: bank-transfer columns --------------------------------
alter table public.purchase_requests
  add column bank_transfer_proof_path text,
  add column bank_transfer_proof_uploaded_at timestamptz,
  add column bank_transfer_reviewed_by uuid references public.users(id),
  add column bank_transfer_reviewed_at timestamptz,
  add column bank_transfer_rejection_reason text;

-- 3. Extend the column-level guard trigger -----------------------------------
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

    new.vehicle_id := old.vehicle_id;
    new.buyer_id := old.buyer_id;
    new.shipping_rate_id := old.shipping_rate_id;
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

-- Trigger already exists (created in 0011); CREATE OR REPLACE FUNCTION above
-- is enough to pick up this new behavior, no need to touch the trigger itself.

revoke execute on function public.purchase_requests_guard_negotiation()
  from public, anon, authenticated;

-- 4. Storage bucket -----------------------------------------------------------
-- Private (public = false) — payment proof, not listing media. 10 MiB,
-- images or a PDF (a bank's emailed confirmation is often saved as one).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-transfer-proofs',
  'bank-transfer-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object key convention: bank-transfer-proofs/<buyer uid>/<purchase_request_id>/<uuid>.<ext>
-- (storage.foldername(name))[1] is the buyer-uid segment (ownership, same
-- convention as vehicle-photos/vehicle-videos); [2] is the reservation id —
-- checked against purchase_requests.buyer_id so a buyer can't upload a proof
-- into their own folder against someone else's reservation.
drop policy if exists "bank transfer proofs owner insert" on storage.objects;
create policy "bank transfer proofs owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bank-transfer-proofs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (
      select 1 from public.purchase_requests pr
      where pr.id::text = (storage.foldername(name))[2]
        and pr.buyer_id = auth.uid()
    )
  );

-- Read-only after upload: the owning buyer or an admin. No update/delete
-- policy for anyone — proof is evidence once submitted, same as
-- policy_acceptances.
drop policy if exists "bank transfer proofs owner read" on storage.objects;
create policy "bank transfer proofs owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bank-transfer-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or public.is_admin()
    )
  );
