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
  countries coming)", including the homepage "Import check" card and How
  It Works step 1; Ghana, Togo and Benin show "Import rules not yet
  checked".
- The VIN must be marked **verified** before a listing can be approved
  (migration 0047), which makes "the VIN is checked against U.S. records
  before a listing goes live" true.
- Outside the code: Stripe business name and statement descriptor,
  Supabase SMTP sender name, `RESEND_FROM_ADDRESS` and
  `NEXT_PUBLIC_WHATSAPP_MESSAGE` in Netlify should all say "ShipMova".

## Pre-launch cleanup

Test data in the production database (previews and shipmova.com share one
Supabase project) to remove before launch.

- [ ] **Honda Accord test reservation `c960b47d-f727-4d51-a51e-ead9ca4d4066`**
      (buyer `tbakare2+buyer2@gmail.com`, status `under_review`, ShipMova fee
      marked paid) and its **completed shipment
      `bc214ae9-f287-4e12-b100-ea8c33f8c286`** (Test Shipping Co, $1,835 rate,
      $146.80 commission, `commission_charge_status = charged`, Stripe
      PaymentIntent `pi_3UD7phLXeJirt4DU0omdA3sP`). Kept for now as the only
      example of a completed, charged shipment. Delete the shipment first,
      then the reservation (`shipment_requests.purchase_request_id` has no
      cascade).
      **Stripe mode: not yet confirmed.** Checked 2026-10-01: the
      `sk_test_` key in local `.env.local` gets `resource_missing` for this
      PaymentIntent, without Stripe's usual "a similar object exists in live
      mode" hint, so it belongs to a different Stripe account than the local
      key, not to that account's live mode. Production's key mode couldn't be
      read from here. To settle it: in the Stripe dashboard, search
      `pi_3UD7phLXeJirt4DU0omdA3sP` with the **Test mode** toggle on, then
      off. If it's live, refund or write it off before deleting the record.

- [ ] **e2e test seller `tbakare2+e2e-webkit@gmail.com`**
      (user `ffc205b6-34a5-4849-bcd9-1e6150377d15`) and its **draft listing
      "TEST E2E WEBKIT — DELETE ME"** (`f1bdadbd-600e-488a-ba57-deb127109f10`,
      VIN `JH4KA7561PC008269`, 3 photos under `vehicle-photos/ffc205b6-…/`).
      Kept on purpose for `npm run e2e:photos` (WebKit photo upload test). Its
      password lives only in `.env.local` / CI secrets, never in the repo.
      Before launch: exclude it from every user and listing count (admin
      dashboard "Total users" includes it today), or delete it and run the
      e2e test against a staging project instead.

- [ ] **"TEST – DELETE ME" 2015 Toyota Camry** (`a850b815-8303-4468-8747-d2843969b756`,
      VIN `4T1BF1FK6FU918273`, draft, seller `tbakare2@gmail.com`) and its
      **fake title file** `vehicle-title-photos/bff57c0a-c762-4b7d-82d4-1129f3b7a2da/34073b90-c3c1-4171-a7ef-c9ee431022a7.jpg`,
      plus any photos uploaded to it. Created 2026-10-04 to retest photo upload
      on iPhone. Remove the listing with its photos and title file. (The 2012
      LR4 draft `2ff0684d` is real data, not test data.)

## Planned next (Day 2, not started)

- **"Preview listing" on each seller dashboard card.** A seller opens their own
  draft or pending listing exactly as buyers will see it. The listing page
  only shows approved cars today, so this needs an owner-only preview path,
  with RLS still deciding what the seller can read.
- **Test-account flag on users.** Mark accounts like the e2e test seller as
  test data and exclude them from every admin count and metric (admin
  dashboard "Total users" includes them today). The flag must be admin-only:
  owner-write RLS on `users` doesn't restrict columns, so it needs the same
  guard-trigger treatment as other admin-only fields.

## Post-launch (decided, don't build before launch)

- **Phone video upgrades:** separate Record / Choose buttons, a 60-second
  limit, and moving video to Cloudflare Stream or Mux.

