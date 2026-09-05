-- MOVA Phase 2 — Reservation fee split + fee payment flow
--
-- Per-listing choice of who covers MOVA's 8% service fee, a price snapshot on
-- the reservation, and the fields the fee-payment (Stripe Checkout) flow writes
-- back: payment status, the checkout session, and the seller contact / wire
-- details that are revealed to the buyer once the fee is paid.

create type fee_responsibility as enum ('buyer_pays_full', 'split');
create type mova_fee_payment_status as enum ('pending', 'paid');

alter table public.vehicles
  add column fee_responsibility fee_responsibility not null default 'buyer_pays_full';

alter table public.purchase_requests
  -- Snapshot of the vehicle price at reservation time. mova_fee_usd (the full
  -- 8% fee) already exists from the initial schema.
  add column vehicle_price_usd numeric(12,2),
  add column mova_fee_payment_status mova_fee_payment_status not null default 'pending',
  add column mova_fee_stripe_session_id text,
  add column mova_fee_checkout_url text,
  add column seller_details_revealed_at timestamptz,
  -- Seller contact + name, snapshotted by the payments webhook when the fee is
  -- paid. Snapshotted (rather than joined) because RLS keeps a buyer from
  -- reading the seller's users / seller_profiles rows directly.
  add column seller_name text,
  add column seller_email text,
  add column seller_phone text,
  add column seller_whatsapp text;
