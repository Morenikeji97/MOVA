-- Reconcile migrations 0029 (shipper service areas) and 0030 (referral
-- program) with production.
--
-- Both were committed on 2026-09-19 but never applied to the production
-- database (found 2026-10-04: no shippers.service_areas, no users referral
-- columns, no referral tables). Meanwhile later migrations rewrote three of
-- the functions 0030 replaces, so applying 0030 as written would put older
-- bodies back:
--   - handle_new_user(): 0030's version drops buyer/seller profile creation
--     and policy-acceptance logging (buyer_protection_policy, 0017);
--   - purchase_requests_guard_negotiation(): 0030's version names seller
--     contact columns dropped in 0040 and lacks the buyer shipping-rate rule
--     and fee_payment_requested_at lock added since;
--   - users_guard_admin_only_fields(): unchanged since 0010, safe either way.
--
-- This migration brings production to what 0029 and 0030 intended, built
-- on the live function bodies. It is idempotent (if not exists / or replace
-- / drop-then-create), so on a database rebuilt from scratch, where 0029
-- and 0030 already ran, it changes nothing but the three functions — which
-- it sets to the merged, current versions.

-- ── 0029: shipper pickup service areas ─────────────────────────────────────
alter table public.shippers
  add column if not exists service_areas text[] not null default '{}';

grant select (service_areas) on public.shippers to anon, authenticated;

-- Same as the live view plus s.service_areas (a new column can't be inserted
-- mid-view with create or replace, so drop and recreate; nothing depends on
-- the view).
drop view if exists public.shipper_rates_public;
create view public.shipper_rates_public
with (security_invoker = true) as
select
  r.id as rate_id,
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
  s.payment_status
from public.shipping_rates r
join public.shippers s on s.id = r.shipper_id
where r.active
  and s.status = 'approved'
  and s.payment_status <> 'suspended';

grant select on public.shipper_rates_public to anon, authenticated;

-- ── 0030 §1: users referral identity + signup fraud signals ────────────────
alter table public.users
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.users(id) on delete set null,
  add column if not exists signup_ip text,
  add column if not exists signup_device_fingerprint text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_referral_code_key'
  ) then
    alter table public.users add constraint users_referral_code_key unique (referral_code);
  end if;
end $$;

update public.users
set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code is null;

alter table public.users alter column referral_code set not null;

create index if not exists users_referred_by_idx on public.users (referred_by);

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
    if v_attempts > 20 then
      raise exception 'users_generate_referral_code: could not find a unique code';
    end if;
  end loop;

  new.referral_code := v_code;
  return new;
end;
$$;

drop trigger if exists users_generate_referral_code on public.users;
create trigger users_generate_referral_code
  before insert on public.users
  for each row execute procedure public.users_generate_referral_code();

revoke execute on function public.users_generate_referral_code() from public, anon, authenticated;

-- handle_new_user(): the live version (role, buyer/seller profile,
-- policy_version acceptance) plus 0030's referral fields. A referral code
-- that matches nothing is ignored — it never blocks signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role user_role;
  v_policy_version text;
  v_referral_code text;
  v_referred_by uuid;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer');
  v_policy_version := nullif(new.raw_user_meta_data->>'policy_version', '');

  v_referral_code := nullif(trim(new.raw_user_meta_data->>'referral_code'), '');
  if v_referral_code is not null then
    select id into v_referred_by from public.users where referral_code = upper(v_referral_code);
  end if;

  insert into public.users (id, email, role, status, referred_by, signup_ip, signup_device_fingerprint)
  values (
    new.id,
    new.email,
    v_role,
    'active',
    v_referred_by,
    nullif(trim(new.raw_user_meta_data->>'signup_ip'), ''),
    nullif(trim(new.raw_user_meta_data->>'signup_device_fingerprint'), '')
  );

  if v_role = 'buyer' then
    insert into public.buyer_profiles (user_id, policy_version)
    values (new.id, v_policy_version);
  elsif v_role = 'seller' then
    insert into public.seller_profiles (user_id, policy_version)
    values (new.id, v_policy_version);
  end if;

  -- Only log an acceptance if the signup form actually sent one — an admin-
  -- created account or any future signup path that doesn't pass
  -- policy_version shouldn't fabricate an acceptance that was never given.
  if v_policy_version is not null then
    insert into public.policy_acceptances (user_id, role, context, policy_version)
    values (new.id, v_role, 'signup', v_policy_version);
  end if;

  return new;
end;
$$;

-- users_guard_admin_only_fields(): the live version (0010) plus 0030's four
-- write-once columns.
create or replace function public.users_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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

-- ── 0030 §2: payment-method fingerprint on reservations ────────────────────
alter table public.purchase_requests
  add column if not exists mova_fee_payment_method_fingerprint text;

-- purchase_requests_guard_negotiation(): the live version, plus locking the
-- new fingerprint column on both non-admin paths (it's written only by the
-- payments webhook / admin confirm, which take the early return).
create or replace function public.purchase_requests_guard_negotiation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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

    new.mova_fee_payment_method_fingerprint := old.mova_fee_payment_method_fingerprint;
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

-- ── 0030 §3: referral ledger + payout batches ──────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'referral_role') then
    create type referral_role as enum ('buyer', 'seller');
  end if;
  if not exists (select 1 from pg_type where typname = 'referral_flag_status') then
    create type referral_flag_status as enum ('clear', 'flagged');
  end if;
  if not exists (select 1 from pg_type where typname = 'referral_payout_status') then
    create type referral_payout_status as enum ('pending', 'processing', 'paid', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'referral_payout_method') then
    create type referral_payout_method as enum ('stripe_transfer', 'bank_transfer');
  end if;
end $$;

create table if not exists public.referral_payout_batches (
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

create index if not exists referral_payout_batches_referrer_idx
  on public.referral_payout_batches (referrer_id, created_at);
create index if not exists referral_payout_batches_status_idx
  on public.referral_payout_batches (status) where status = 'pending';

create table if not exists public.referral_credits (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  role referral_role not null,
  purchase_request_id uuid not null references public.purchase_requests(id),
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

create index if not exists referral_credits_referrer_idx
  on public.referral_credits (referrer_id, created_at);
create index if not exists referral_credits_flagged_idx
  on public.referral_credits (flag_status) where flag_status = 'flagged';
create index if not exists referral_credits_unbatched_idx
  on public.referral_credits (referrer_id, created_at) where payout_batch_id is null;

alter table public.referral_credits enable row level security;
alter table public.referral_payout_batches enable row level security;

drop policy if exists "referral credits self or admin read" on public.referral_credits;
create policy "referral credits self or admin read" on public.referral_credits
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());
drop policy if exists "referral credits admin review update" on public.referral_credits;
create policy "referral credits admin review update" on public.referral_credits
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "referral payout batches self or admin read" on public.referral_payout_batches;
create policy "referral payout batches self or admin read" on public.referral_payout_batches
  for select using (referrer_id = auth.uid() or public.is_admin());
drop policy if exists "referral payout batches admin update" on public.referral_payout_batches;
create policy "referral payout batches admin update" on public.referral_payout_batches
  for update using (public.is_admin()) with check (public.is_admin());

-- ── 0030 §4: annual payout totals (for 1099 bookkeeping later) ──────────────
create or replace view public.referral_annual_payouts
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
