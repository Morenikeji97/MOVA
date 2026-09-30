-- ShipMova — a listing can only go live once its VIN check is 'verified'.
--
-- Makes the buyer promise "the VIN is checked against U.S. records before a
-- listing goes live" true. Until now only a 'flagged' VIN blocked approval
-- (vehicles_flagged_not_approved, 0007); 'unverified' and 'checking' could
-- still be approved. Applies to every role, admins included. The admin page
-- disables Approve and says why (lib/listings-review.ts canApproveListing).
--
-- Checked before adding: no approved listings existed, so no row violates it.

alter table public.vehicles
  add constraint vehicles_vin_verified_before_approval
    check (status <> 'approved' or vin_verification_status = 'verified');
