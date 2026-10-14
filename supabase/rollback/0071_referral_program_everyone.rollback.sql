-- Rollback for 0071. Only safe while no shipper/inspector credit exists yet
-- (check first: select count(*) from public.referral_credits where role in
-- ('shipper', 'inspector') — restoring purchase_request_id's NOT NULL would
-- otherwise fail on those rows).
begin;
alter table public.referral_credits drop constraint if exists referral_credits_one_qualifying_ref;
drop index if exists referral_credits_shipment_idx;
drop index if exists referral_credits_inspection_idx;
alter table public.referral_credits
  drop column if exists shipment_request_id,
  drop column if exists inspection_id,
  alter column purchase_request_id set not null;

alter table public.waitlist_signups drop constraint if exists waitlist_signups_source_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_source_check
    check (source in ('site', 'listing', 'dashboard', 'home', 'how_it_works', 'browse', 'sell',
                      'shipper', 'inspectors', 'clearing_agents'));
commit;
