-- 0070 — widen referral_role to add 'shipper' and 'inspector' (founder,
-- 2026-10-14: the referral program opens to shippers and inspectors too —
-- see 0071 for the rest of that change).
--
-- Split into its own migration on purpose: Postgres won't let a newly
-- added enum value be USED (e.g. in a CHECK constraint) within the same
-- transaction/migration that added it ("unsafe use of new value of enum
-- type"). 0071 is the one that actually uses these two values.

alter type referral_role add value if not exists 'shipper';
alter type referral_role add value if not exists 'inspector';
