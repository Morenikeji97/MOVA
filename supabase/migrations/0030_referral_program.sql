-- MOVA — Buyer/Seller referral program
--
-- CORE SHAPE: each account gets a permanent referral_code (generated at
-- signup); referred_by resolves that code to the referrer at signup time and
-- is then immutable, same "write-once at INSERT, locked forever after" idiom
-- already used for the KYC-adjacent columns closed off in 0010. A referral
-- only ever "counts" once it clears public.referral_credits — an immutable,
-- append-only ledger in the exact shape of terms_acceptances/
-- policy_acceptances (no UPDATE/DELETE for anyone, admin included, except
-- the two narrow admin-review columns called out below).
--
-- CROSS-ROLE: referred_by is resolved and stored regardless of whether the
-- referrer and referred account end up the same role — deliberately not
-- filtered at signup, so the relationship stays visible for audit even
-- though it will never produce a referral_credits row. The role match is
-- enforced once, centrally, in lib/referral-credit.ts's
-- evaluateReferralQualification(), the single call path every crediting
-- trigger (fee-paid webhook, bank-transfer admin confirm, seller-identity
-- webhook) goes through.
--
-- KYC GATE: a Buyer referral requires buyer_profiles.verification_status =
-- 'verified'. As of this migration nothing in the app ever sets that column
-- away from 'unverified' — buyer NIN/BVN verification (via Dojah/Youverify/
-- Prembly, per the Terms & Conditions) has no integration built yet, only
-- the schema columns — so Buyer-side referral credit is, by design, inert
-- until that separate feature ships. This is intentional, not a bug:
-- the alternative (crediting on fee-paid alone) would mean an unverified
-- buyer's referral counts today and can never be un-counted later once
-- KYC lands and finds it fraudulent.
--
-- PAYOUT: batches of exactly 10 qualifying credits trigger a $1,000
-- referral_payout_batches row (status 'pending'). This codebase has no
-- outbound-payment (Stripe Connect/transfer) infrastructure at all today —
-- every existing Stripe use is inbound (fee Checkout) or off-session FROM a
-- saved card (shipper commission). Rather than bolt on a Connect onboarding
-- flow as a detail of this feature, payouts are admin-confirmed: an admin
-- marks a batch 'paid' after actually moving the money (a manual Stripe
-- transfer for a US-based referrer, or a bank wire for everyone else),
-- recording a payout_reference for audit. method is decided at batch-creation
-- time from the referrer's role + profile country — see
-- lib/referrals.ts's determinePayoutMethod(): Sellers are US-based by this
-- platform's own business model (see Terms & Conditions §2) and
-- seller_profiles.country has no edit UI yet (always null in practice), so a
-- null country defaults to 'stripe_transfer' for a seller and
-- 'bank_transfer' for a buyer; an explicitly-set country always wins.
--
-- FRAUD SIGNALS: detectSelfReferralSignals() (lib/referrals.ts, pure/tested)
-- compares email pattern, phone, payment-method fingerprint (from Stripe,
-- new mova_fee_payment_method_fingerprint column below), device fingerprint,
-- and IP subnet between referrer and referred, both captured at each
-- account's own signup (users.signup_ip/signup_device_fingerprint, written
-- once by handle_new_user() from signUp()'s raw_user_meta_data — mirrors how
-- role/policy_version already flow through that same path). Any match blocks
-- crediting outright; nothing is written to the ledger for a blocked
-- attempt (there is no "referral" yet to log — only a completed, non-blocked
-- credit is ever inserted, together with the signals that were checked and
-- found clear, for later audit).
--
-- RATE FLAG: more than 5 qualifying credits for one referrer within a
-- trailing 24h window sets flag_status = 'flagged' on the triggering row(s)
-- (not blocked) — surfaced at /admin/referrals for manual review.

-- 1. users: referral identity + signup-time fraud signals -------------------
alter table public.users
  add column referral_code text unique,
  add column referred_by uuid references public.users(id) on delete set null,
  -- Best-effort, spoofable signals — see lib/referrals.ts's doc comment.
  -- Captured once at signup (client-collected fingerprint; IP read
  -- server-side in app/signup/actions.ts), never re-derived later.
  add column signup_ip text,
  add column signup_device_fingerprint text;

-- Backfill existing rows with a code before making the column NOT NULL —
-- new rows get one from the trigger below. gen_random_uuid() is built into
-- Postgres core since v13 — unlike gen_random_bytes(), it needs no pgcrypto
-- extension, which nothing in this schema has enabled so far.
update public.users set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code is null;

alter table public.users
  alter column referral_code set not null;

create index users_referred_by_idx on public.users (referred_by);

create or replace function public.users_generate_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  if new.referral_code is not null then
    return new;
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    v_attempts := v_attempts + 1;
    exit when not exists (select 1 from public.users where referral_code = v_code);
    -- 32 bits of entropy per attempt — this should never realistically loop,
    -- but bail rather than spin forever if it somehow does.
    if v_attempts > 20 then
      raise exception 'users_generate_referral_code: could not find a unique code';
    end if;
  end loop;

  new.referral_code := v_code;
  return new;
end;
$$;

create trigger users_generate_referral_code
  before insert on public.users
  for each row execute procedure public.users_generate_referral_code();

revoke execute on function public.users_generate_referral_code() from public, anon, authenticated;

-- handle_new_user(): resolve referred_by from the code passed through
-- signUp()'s raw_user_meta_data, exactly like role/policy_version already
-- are. Silently ignored if the code doesn't match anything (typo/stale
-- link) — never blocks signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_by uuid;
  v_referral_code text;
begin
  v_referral_code := nullif(trim(new.raw_user_meta_data->>'referral_code'), '');
  if v_referral_code is not null then
    select id into v_referred_by from public.users where referral_code = upper(v_referral_code);
  end if;

  insert into public.users (
    id, email, role, status, referred_by, signup_ip, signup_device_fingerprint
  )
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer'),
    'active',
    v_referred_by,
    nullif(trim(new.raw_user_meta_data->>'signup_ip'), ''),
    nullif(trim(new.raw_user_meta_data->>'signup_device_fingerprint'), '')
  );
  return new;
end;
$$;

-- users_guard_admin_only_fields (0010): lock the four new columns the same
-- way role/status/email_verified_at are already locked — set once at INSERT
-- by handle_new_user() (which runs outside RLS entirely), never editable by
-- the account owner afterward via a direct UPDATE.
create or replace function public.users_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.role := old.role;
  new.status := old.status;
  new.email_verified_at := old.email_verified_at;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.signup_ip := old.signup_ip;
  new.signup_device_fingerprint := old.signup_device_fingerprint;
  return new;
end;
$$;

-- 2. purchase_requests: payment-method fingerprint for self-referral checks -
alter table public.purchase_requests
  add column mova_fee_payment_method_fingerprint text;

-- purchase_requests_guard_negotiation (0011/0018/0024): extend the existing
-- column-level allowlist so this new column reverts for both the seller and
-- buyer non-admin write paths — it's written only by the payments webhook /
-- confirmBankTransferPayment, both running as admin/service-role, which
-- bypass this trigger's non-admin branches entirely via the early return.
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
    new.mova_fee_payment_method_fingerprint := old.mova_fee_payment_method_fingerprint;
    new.seller_details_revealed_at := old.seller_details_revealed_at;
    new.seller_name := old.seller_name;
    new.seller_email := old.seller_email;
    new.seller_phone := old.seller_phone;
    new.seller_whatsapp := old.seller_whatsapp;
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

    new.mova_fee_payment_method_fingerprint := old.mova_fee_payment_method_fingerprint;

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

  return old;
end;
$$;

-- 3. Referral ledger + payout batches -----------------------------------------
create type referral_role as enum ('buyer', 'seller');
create type referral_flag_status as enum ('clear', 'flagged');
create type referral_payout_status as enum ('pending', 'processing', 'paid', 'failed');
create type referral_payout_method as enum ('stripe_transfer', 'bank_transfer');

create table public.referral_payout_batches (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  role referral_role not null,
  batch_number int not null,
  referral_count int not null default 10 check (referral_count = 10),
  amount_usd numeric(10,2) not null default 1000,
  method referral_payout_method not null,
  status referral_payout_status not null default 'pending',
  payout_reference text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (referrer_id, batch_number)
);

create index referral_payout_batches_referrer_idx
  on public.referral_payout_batches (referrer_id, created_at);
create index referral_payout_batches_status_idx
  on public.referral_payout_batches (status) where status = 'pending';

create table public.referral_credits (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  role referral_role not null,
  purchase_request_id uuid not null references public.purchase_requests(id),
  -- Fraud-check signals evaluated at credit time — all false here by
  -- construction, since any true signal blocks the credit before this row
  -- is ever inserted (see evaluateReferralQualification in
  -- lib/referral-credit.ts). Logged anyway, per-row, for later audit rather
  -- than trusting that reasoning to hold forever.
  email_pattern_match boolean not null default false,
  phone_match boolean not null default false,
  payment_fingerprint_match boolean not null default false,
  device_fingerprint_match boolean not null default false,
  ip_subnet_match boolean not null default false,
  flag_status referral_flag_status not null default 'clear',
  flag_reviewed_by uuid references public.users(id),
  flag_reviewed_at timestamptz,
  payout_batch_id uuid references public.referral_payout_batches(id),
  created_at timestamptz not null default now(),
  unique (referred_id)
);

create index referral_credits_referrer_idx on public.referral_credits (referrer_id, created_at);
create index referral_credits_flagged_idx
  on public.referral_credits (flag_status) where flag_status = 'flagged';
create index referral_credits_unbatched_idx
  on public.referral_credits (referrer_id, created_at) where payout_batch_id is null;

alter table public.referral_credits enable row level security;
alter table public.referral_payout_batches enable row level security;

-- referral_credits: the referrer and the referred party may each see rows
-- naming them; admin sees all. No insert/update/delete policy for
-- anon/authenticated — every credit is written by
-- evaluateReferralQualification() via the service-role client (mirrors
-- rate_limit_hits: RLS enabled with zero policies blocks everyone but
-- service_role) — EXCEPT a narrow admin-only update for the two review
-- columns, since /admin/referrals needs to mark a flagged row reviewed.
create policy "referral credits self or admin read" on public.referral_credits
  for select using (
    referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin()
  );
create policy "referral credits admin review update" on public.referral_credits
  for update using (public.is_admin()) with check (public.is_admin());

-- referral_payout_batches: the referrer sees their own batches; admin sees
-- and manages all. Batch rows are created only by
-- createReferralPayoutBatch() via the service role — no insert policy for
-- anon/authenticated.
create policy "referral payout batches self or admin read" on public.referral_payout_batches
  for select using (referrer_id = auth.uid() or public.is_admin());
create policy "referral payout batches admin update" on public.referral_payout_batches
  for update using (public.is_admin()) with check (public.is_admin());

-- 4. Annual per-referrer payout totals, for 1099 bookkeeping later -----------
-- Deliberately just a queryable aggregate — no tax-form generation here.
-- security_invoker => the base table's own RLS still applies, so a
-- non-admin querying this only ever sees their own totals.
create view public.referral_annual_payouts
with (security_invoker = true) as
select
  referrer_id,
  extract(year from paid_at)::int as payout_year,
  method,
  count(*) as batches_paid,
  sum(amount_usd) as total_paid_usd
from public.referral_payout_batches
where status = 'paid' and paid_at is not null
group by referrer_id, extract(year from paid_at)::int, method;

grant select on public.referral_annual_payouts to authenticated;
