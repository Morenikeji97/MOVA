# ShipMova — launch blockers

ShipMova is in **pre-launch mode**: a site-wide banner frames the site as "how
it will work", and reserving and paying are switched off (see
`lib/prelaunch.ts`). The public copy describes several things that are **not
built yet**. Each item below must be built — and checked on a deploy
preview — before pre-launch mode is switched off.

**Do not turn off pre-launch** (`PRELAUNCH=false` in Netlify, plus
`update public.platform_settings set prelaunch = false;`) while any box
below is unticked. Each item lists the public copy that depends on it, so
the copy can be changed instead if a feature is dropped.

## Blockers

- [ ] **Shipper verification: FMC license, bond and cargo insurance, plus
      an "Insured" badge.**
      Today the shipper signup collects only an FMC OTI license number; bond
      and cargo insurance aren't collected or verified anywhere, and no
      "Insured" badge exists. Needs: fields and document uploads for bond
      and insurance, admin verification (with expiry dates), the badge on
      shipper listings and quotes, and blocking unverified shippers from
      being booked.
      Copy that depends on it:
      - `/shipper`: "A verified-only network — We check every shipper's FMC
        license, bond and cargo insurance, and show buyers an 'Insured'
        badge."
      - Homepage "What the 8% covers": "Verified shippers — licensed, bonded
        and insured for cargo. We check this ourselves…"
      - `/sell`: "A licensed, insured shipper picks up the car…" (FAQ and
        "We handle the hard parts")

- [ ] **Escrow.com payment of the car price.**
      No Escrow.com integration exists. Needs: creating the escrow
      transaction, showing its status to buyer and seller, releasing to the
      seller only after a passed inspection and shipper custody of the car
      and original title.
      Copy that depends on it: homepage hero, "Your money never goes to a
      stranger", "Why buy" ("Your money is protected"), the comparison
      table ("Licensed escrow"), `/sell` ("How you get paid", "Paid at
      pickup", "No overseas payment risk"), `/shipper` ("buyer has already
      paid into escrow"), Terms §4, Buyer Protection §2 and §6.

- [ ] **In-person inspection before pickup.**
      No inspection step exists. Needs: inspector onboarding (the
      `/inspectors` waitlist is only interest capture), the short knowledge
      check, assigning inspections, the checklist and photo report (VIN,
      mileage, title, condition), pass/fail feeding escrow release, and
      paying inspectors 2% of the car price per completed inspection.
      Copy that depends on it: "Why buy" ("Someone checks the car for you"),
      the comparison table ("Car inspected in person before shipping"),
      "Your money never goes to a stranger" step 3, `/inspectors` (all
      cards), Buyer Protection §2 and §4.

- [ ] **Partner clearing agents: referrals and rewards.**
      Needs: onboarding partner agents from the `/clearing-agents` waitlist,
      recommending them to buyers whose shipment doesn't include clearing,
      and the partner referral reward scheme.
      Copy that depends on it: `/clearing-agents` ("Buyers sent your way",
      "Rewards for partners"), How It Works step 7 ("…or one we recommend").

## Also true today, but worth re-checking at launch

- Import rules exist for **Nigeria only**. Copy says "Nigeria (more
  countries coming)"; Ghana, Togo and Benin show "Import rules not yet
  checked". Two older lines still say "your country" — homepage "Import
  check" and How It Works step 1 — and should match before launch.
- The VIN must be marked **verified** before a listing can be approved
  (migration 0047), which makes "the VIN is checked against U.S. records
  before a listing goes live" true.
- Outside the code: Stripe business name and statement descriptor,
  Supabase SMTP sender name, `RESEND_FROM_ADDRESS` and
  `NEXT_PUBLIC_WHATSAPP_MESSAGE` in Netlify should all say "ShipMova".
