-- MOVA — pre-launch mode, the waitlist, and "fee paid" without the
-- contact reveal.
--
-- Additive and safe to apply while the previous app build is live: it adds
-- tables/functions/triggers and rewrites two checks without changing their
-- outcome for any existing row. The drop of the direct-wire contact
-- snapshot columns is in 0040, applied only after the app code that stops
-- using them is deployed.

-- 1. Pre-launch flag -------------------------------------------------------
--
-- The app's PRELAUNCH env var (lib/prelaunch.ts) drives the UI and the
-- server actions. This row is the same switch for anyone who skips the app
-- and calls the REST API with their own session — the triggers below read
-- it. Going live means flipping both; see lib/prelaunch.ts.
create table public.platform_settings (
  id boolean primary key default true check (id), -- single row
  prelaunch boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, prelaunch) values (true, true);

alter table public.platform_settings enable row level security;

create policy "platform settings public read" on public.platform_settings
  for select using (true);
create policy "platform settings admin update" on public.platform_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Fails closed: no row reads as pre-launch.
create or replace function public.is_prelaunch()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select prelaunch from public.platform_settings where id), true);
$$;

grant execute on function public.is_prelaunch() to anon, authenticated;

-- 2. Refuse reservations and fee payments while pre-launch ---------------
--
-- Admins and the service role (Stripe webhook, cron) are exempt — this
-- stops buyers, not MOVA's own back office.
--
-- INSERT: no new reservation.
-- UPDATE: no change to a reservation's fee-payment state by a buyer or
-- seller (the bank-transfer proof path is the only one they have). Runs
-- AFTER purchase_requests_guard_negotiation in trigger-name order, so it
-- sees only changes that guard let through, and raises rather than
-- silently reverting so the caller knows the request was refused.
create or replace function public.purchase_requests_prelaunch_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_prelaunch()
     or public.is_admin()
     or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'prelaunch_reservations_closed'
      using errcode = 'check_violation',
            hint = 'MOVA is launching soon and is not taking reservations yet.';
  end if;

  if new.mova_fee_payment_status is distinct from old.mova_fee_payment_status
     or new.payment_method is distinct from old.payment_method
     or new.bank_transfer_proof_path is distinct from old.bank_transfer_proof_path then
    raise exception 'prelaunch_payments_closed'
      using errcode = 'check_violation',
            hint = 'MOVA is launching soon and is not taking payments yet.';
  end if;

  return new;
end;
$$;

revoke execute on function public.purchase_requests_prelaunch_guard() from public, anon, authenticated;

create trigger purchase_requests_prelaunch_guard
  before insert or update on public.purchase_requests
  for each row execute procedure public.purchase_requests_prelaunch_guard();

-- 3. Waitlist --------------------------------------------------------------
--
-- Anyone (signed in or not) may add a row; nobody but an admin may read,
-- change or delete one. The CHECKs mirror lib/prelaunch.ts's
-- validateWaitlist() so a direct API insert gets the same rules as the form.
create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text check (
    email is null
    or (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  whatsapp text check (
    whatsapp is null or whatsapp ~ '^\+?[0-9][0-9 ()-]{6,19}$'
  ),
  country text not null check (country in ('NG', 'GH', 'TG', 'BJ', 'OTHER')),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  source text not null default 'site' check (source in ('site', 'listing', 'dashboard')),
  created_at timestamptz not null default now(),
  constraint waitlist_signups_contact_required check (email is not null or whatsapp is not null)
);

create index waitlist_signups_created_idx on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;

create policy "waitlist anyone insert" on public.waitlist_signups
  for insert to anon, authenticated with check (true);
create policy "waitlist admin read" on public.waitlist_signups
  for select using (public.is_admin());

-- Insert-only for the public roles at the privilege level too, so there is
-- no update/delete path even if a policy is added by mistake later.
revoke all on public.waitlist_signups from anon, authenticated;
grant insert (email, whatsapp, country, vehicle_id, source)
  on public.waitlist_signups to anon, authenticated;
grant select on public.waitlist_signups to authenticated; -- rows gated to admins by RLS

-- 4. "Fee paid" no longer means "contact revealed" -----------------------
--
-- vehicle_vin (0036) and the review-eligibility policy (0006) checked
-- mova_fee_payment_status = 'paid' AND seller_details_revealed_at IS NOT
-- NULL. Both were always set together, so dropping the second clause
-- changes nothing for any existing row; it removes the dependency so 0040
-- can drop the column.
create or replace function public.vehicle_vin(p_vehicle_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select v.vin
  from public.vehicles v
  where v.id = p_vehicle_id
    and auth.uid() is not null
    and (
      public.is_admin()
      or v.seller_id = auth.uid()
      or exists (
        select 1 from public.purchase_requests pr
        where pr.vehicle_id = v.id
          and pr.buyer_id = auth.uid()
          and pr.mova_fee_payment_status = 'paid'
      )
    );
$$;

drop policy "reviews insert when eligible" on public.reviews;
create policy "reviews insert when eligible" on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and status = 'pending'
    and rating between 1 and 5
    and reviewer_id is distinct from reviewee_id
    and (
      (
        review_type = 'buyer_to_seller'
        and reviewee_shipper_id is null
        and shipment_request_id is null
        and exists (
          select 1
          from public.purchase_requests pr
          join public.vehicles v on v.id = pr.vehicle_id
          where pr.id = reviews.purchase_request_id
            and pr.buyer_id = auth.uid()
            and v.seller_id = reviews.reviewee_id
            and pr.mova_fee_payment_status = 'paid'
        )
      )
      or (
        review_type = 'seller_to_buyer'
        and reviewee_shipper_id is null
        and shipment_request_id is null
        and exists (
          select 1
          from public.purchase_requests pr
          join public.vehicles v on v.id = pr.vehicle_id
          where pr.id = reviews.purchase_request_id
            and v.seller_id = auth.uid()
            and pr.buyer_id = reviews.reviewee_id
            and pr.mova_fee_payment_status = 'paid'
        )
      )
      or (
        review_type = 'buyer_to_shipper'
        and reviewee_id is null
        and purchase_request_id is null
        and exists (
          select 1
          from public.shipment_requests sr
          where sr.id = reviews.shipment_request_id
            and sr.buyer_id = auth.uid()
            and sr.shipper_id = reviews.reviewee_shipper_id
            and sr.status = 'completed'
        )
      )
    )
  );
