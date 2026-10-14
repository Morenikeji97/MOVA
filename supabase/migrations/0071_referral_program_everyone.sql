-- 0071 — referral program: open to everyone, cross-role (founder,
-- 2026-10-14): "Everyone can refer: buyers, sellers, shippers, inspectors.
-- The referrer earns $100 once per referred person (from any of those
-- sectors), when that person completes their first transaction."
--
-- Run after 0070 (which adds the two enum values this migration uses).
--
-- Previously (0030) a referral only counted when the referrer and the
-- referred account were the SAME role (a buyer referring a buyer, a seller
-- referring a seller); role here meant both people at once. That match is
-- now removed in application code (lib/referral-credit.ts) — referring is
-- open across roles. `referral_credits.role` keeps its existing meaning,
-- narrowed to just the REFERRED person's own qualifying action (it already
-- was that value in every row; nothing to backfill), and
-- `referral_payout_batches.role` keeps meaning the REFERRER's own role
-- (payout-method purposes) — these two meanings simply decouple now that
-- they're no longer always equal.
--
-- Two new qualifying actions need a reference column each, because they
-- aren't a purchase_request:
--   shipper:    their own first shipment_requests row to reach 'completed'
--   inspector:  their own first inspections row to reach pay_status 'paid'
-- So purchase_request_id (required not-null until now, since only Buyer/
-- Seller existed) becomes nullable, and exactly one of the three reference
-- columns must be set, matching the row's own role.
--
-- Additive only: no existing row changes meaning, no existing row is
-- touched (every current row is role buyer/seller with purchase_request_id
-- set, which the new check still accepts).

alter type referral_role add value if not exists 'shipper';
alter type referral_role add value if not exists 'inspector';

alter table public.referral_credits
  alter column purchase_request_id drop not null,
  add column shipment_request_id uuid references public.shipment_requests(id),
  add column inspection_id uuid references public.inspections(id);

alter table public.referral_credits
  add constraint referral_credits_one_qualifying_ref check (
    (role in ('buyer', 'seller') and purchase_request_id is not null
       and shipment_request_id is null and inspection_id is null)
    or (role = 'shipper' and shipment_request_id is not null
       and purchase_request_id is null and inspection_id is null)
    or (role = 'inspector' and inspection_id is not null
       and purchase_request_id is null and shipment_request_id is null)
  );

create index referral_credits_shipment_idx on public.referral_credits (shipment_request_id)
  where shipment_request_id is not null;
create index referral_credits_inspection_idx on public.referral_credits (inspection_id)
  where inspection_id is not null;

-- A Buyer signing up from a "coming soon" country (lib/country-access.ts)
-- is offered the waitlist instead — same table, a new source value so it's
-- distinguishable from the shipping-estimate picker's existing 'listing'.
alter table public.waitlist_signups
  drop constraint waitlist_signups_source_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_source_check
    check (source in ('site', 'listing', 'dashboard', 'home', 'how_it_works', 'browse', 'sell',
                      'shipper', 'inspectors', 'clearing_agents', 'signup'));
