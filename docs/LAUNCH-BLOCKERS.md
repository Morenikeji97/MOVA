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
      **Questions for Escrow.com (partner call):**
      - Can ShipMova open a **second escrow transaction, buyer → shipper,**
        for the shipping price, alongside the car transaction?
      - Can it release in stages: part at verified **pickup** (with the
        original title), the rest at **delivery** / port handoff?
      - Can the shipper payee be a US forwarder shipping to Nigeria, Ghana,
        Togo or Benin, and is anything different when the buyer pays from
        one of those countries?
      - **What does it cost on a ~$1,500 shipment** (fee, who pays it, any
        minimum), and on the typical car transaction?
      - API/webhooks for status (funded, released) so ShipMova can show it
        without staff re-typing it.

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

- [ ] **Live Stripe keys on launch day.** Every Stripe key in Netlify
      (`STRIPE_SECRET_KEY`, publishable key, and all webhook secrets) is test
      mode today. Switch to live keys and live webhook endpoints the day
      ShipMova launches, then make one real low-value payment end to end.

- [ ] **Buyer ID check goes live: Dojah live keys.**
      Buyers verify their ID at sign-up and can't use their account until
      verified (founder's decision 2026-10-05; middleware.ts + chat/reserve
      refuse them server-side). Nigeria: NIN, Ghana: Ghana Card (both via
      Dojah, name must match, mismatches go to /admin/buyer-ids); Togo/Benin:
      ID photo reviewed in /admin/buyer-ids. Until launch Dojah is in
      sandbox: only Dojah's published test numbers (NIN `70123456789`) are
      sent; anything else gets "ID verification opens at launch — join the
      waitlist." No Ghana Card can verify until live (Dojah publishes no
      Ghana test number). On launch day, in this order:
      1. Netlify: `DOJAH_BASE_URL=https://api.dojah.io` plus live
         `DOJAH_SECRET_KEY` / `DOJAH_APP_ID`; redeploy.
      2. Verify one real NIN and one real Ghana Card end to end.
      3. Reset every buyer verified with a sandbox test number (below).
      4. Optional backstop: `update public.platform_settings set require_buyer_id_check = true where id;`
         — the database then also refuses reservations from unverified
         buyers (migration 0057).

- [ ] **Every shipper verified before launch (migration 0060).** Buyers only
      see shippers with an approved, in-date marine cargo insurance
      certificate and an FMC/OTI license checked on the FMC's OTI list
      (/admin/shippers). Each real shipper uploads their certificate in the
      shipper portal; check each license on www2.fmc.gov/oti. Today no real
      shipper exists ("Test Shipping Co" is test and stops being shown once
      0060 runs).

- [ ] **Decide shipping payments** (docs/proposals/shipping-payments-through-escrow.md).
      Today buyers pay shippers directly, and the Terms and Privacy Policy say so.

- [ ] **Re-verify every seller's ID in live mode.** Stripe Identity checks
      done so far ran in test mode, which doesn't verify a real document. At
      launch, reset `seller_profiles` identity status and have each seller
      verify again under the live keys before their listings go live.

- [ ] **Find which Resend key Supabase SMTP uses before deleting "Onboarding".**
      The app uses `RESEND_API_KEY` in Netlify (new, sending-only). Supabase
      Auth sends signup/reset emails through Resend SMTP with its own key
      (Authentication → Emails → SMTP Settings). In Resend, compare each key's
      "Last used" with a known auth email (e.g. 2026-10-04 15:52 UTC). If
      "Onboarding" is the SMTP key: make a new sending-only key, put it in
      Supabase, test a password reset, then delete "Onboarding".

- [ ] **A separate Supabase staging project for tests.**
      Production and every deploy preview share one database today, so any
      test that needs an approved listing, a reservation or a payment state
      either touches live data or can't run. Needs: a staging project with
      the same migrations, previews and `npm run e2e:photos` pointed at it,
      and seed data (test seller, buyer, approved listing, shipper rate).
      Then the e2e test seller and other test rows can leave production.

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
      **Stripe mode: closed — test money** (founder, 2026-10-04). No refund
      or write-off needed; just delete the rows. Since migration 0055 it's
      **SM-000001** and has stage history, which is append-only and blocks
      deleting the reservation: as the database owner, disable trigger
      `transaction_history_append_only`, delete its history rows, the
      shipment and the reservation, then re-enable the trigger, in one
      transaction.

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

- [ ] **Flagged test accounts** (`users.is_test_account = true`, migration
      0054, 2026-10-04): `tbakare2+buyer`, `+buyer2`, `+ref1`, `+shipper` and
      `+e2e-webkit` (all `@gmail.com`). Excluded from admin counts. Not test:
      `tbakare2@gmail.com` (founder's seller account) and `tbakare2+admin`.
      `+shipper3`/`+shipper4`/`+shipper5` never had logins (shipper signup
      only files an application).
      **`tobs20450@yahoo.com`** (seller): not flagged, treated as real.

- [ ] **Friend's accounts: `adedayotoba35@gmail.com` (buyer) and
      `tobs20450@yahoo.com` (seller)** — the same person, helping test.
      Both flagged as test 2026-10-04 (excluded from counts); **not to be
      deleted.** The seller account has 1 listing and an identity check
      left `pending` (test mode).
      **On launch day: unflag both so they're active real users.** First
      remove any test listings, deals and chats they created, and reset
      any test-mode ID verification so he re-verifies in live mode.

- [ ] **Flagged test shipper applications** (`shippers.is_test = true`):
      "Test Shipping Co" (`97e77a5a-…`, approved, `tbakare2+shipper`, the
      only shipping rate in the database, **saved Stripe test card** from the
      old 8% signup), "test shipping", "TESTSHIPPER3", "the test"
      (`+shipper3`) and "MOVATEST@#5" (`+shipper5`). ("MOVATEST@#", which was
      linked to the admin login, was deleted 2026-10-04.) Before launch:
      delete all of them and detach the card in Stripe.

- [ ] **Pamz — `kundaparks@yahoo.com` (buyer)** — a tester. Flagged as test
      2026-10-05 (excluded from counts); **not to be deleted.** He tried his
      real NIN 3 times against Dojah's sandbox (all failed). It was **not
      stored by ShipMova** — no column holds ID numbers and the rate-limit
      rows hold only his user id — and his NIN status was reset to
      `unverified`. Dojah's sandbox did receive it: ask Dojah whether
      sandbox lookups are retained and to delete them. He's using Dojah's
      test NIN `70123456789` for now.
      **On launch day:** reset his ID verification (`nin/bvn_verification_status`
      → `unverified`, `verification_status` → `unverified`) so he re-verifies
      with his real NIN in live mode, then unflag him. Also clear his
      `id_*` columns (migration 0058) and set `id_verified_at` to null.

- [ ] **Test buyer `e2e-buyer@shipmova.com`** (created 2026-10-05, flagged
      test, private — never public). Used by `npm run e2e:buyer-id`;
      password only in `.env.local`. Left **pending** with one Togo test ID
      photo for the founder's #39 phone check (approving/rejecting deletes
      the photo). Before launch: delete the account, and check the
      `buyer-id-documents` bucket has no files under its id.

- [ ] **Restart SM- numbering so the first real deal is SM-000001.**
      Safe as long as no real deal exists yet: the reference is a label only
      (history and every link use the deal's id, nothing assumes the numbers
      are consecutive), but it's unique, so the test deals must give up
      their numbers first. On launch day, as the database owner, in one
      transaction, after the other cleanup:
      1. delete the remaining test deals, **or** keep them and rename their
         references to `TEST-000001…` (disable trigger
         `purchase_requests_reference` for that update only, then re-enable);
      2. `alter sequence public.transaction_reference_seq restart with 1;`
      3. check: `select max(reference) from purchase_requests where reference like 'SM-%'` returns nothing.
      Never restart once a real deal has a number.

## Day 2 (part 1 merged in PR #36; part 2 in progress, branch `day2-transactions`)

- **"Preview listing" on each seller dashboard card.** A seller opens their own
  draft or pending listing exactly as buyers will see it. The listing page
  only shows approved cars today, so this needs an owner-only preview path,
  with RLS still deciding what the seller can read.
- **Test-account flag on users and shipper applications** (migration 0054,
  applied 2026-10-04). Admin-only via the guard triggers; admin counts leave
  flagged rows out.
- **Keep typed fields when a form errors.** Forms that redirect with
  `?error=` (shipper signup first) lose everything typed; on a phone that
  means retyping the whole form. Return the error to the same form and keep
  the values instead.
- **Transaction reference and stage history** (MVP NOW #3): `SM-000001`
  references, append-only stage history written by triggers, escrow
  reference/stage fields.

## Day 3 (proposal, not started): buyers never pay shippers directly

Today the buyer pays the shipper directly, outside ShipMova (Terms §4.4).
That's the one payment ShipMova can't protect, and the riskiest for a buyer
sending money abroad to a company they've never met. Proposal:

1. **Escrow.com for shipping too (recommended for launch).** When the buyer
   picks a shipper, ShipMova opens a second Escrow.com transaction: buyer →
   shipper, for the quoted shipping price. Escrow.com releases it to the
   shipper in two steps (e.g. a share at verified pickup with the original
   title, the rest at proof of delivery / handoff at the port). Same
   principle as the car price: ShipMova never holds the money, and it fits
   the escrow flow buyers already go through. Cost: Escrow.com's fee on the
   shipping amount, and one more transaction for the buyer to fund.
2. **Stripe Connect, later at volume.** Shippers onboard as connected
   accounts; the buyer pays shipping by card through ShipMova; Stripe holds
   the transfer until pickup/delivery is confirmed. Cheaper and smoother for
   buyers, but it makes ShipMova a payment facilitator for shipping (KYC on
   shippers, payout disputes, chargebacks), so not before there's volume.

Either way: shipper rates stay quoted on ShipMova, the "Selected shipper" step
becomes "fund shipping", stage history gets `shipping_funded` /
`shipping_released`, and Terms §4.4 and the shipper terms (v3) change.
**To check before building:** whether Escrow.com supports the two-step
release and a shipper payee in Nigeria-bound shipments, and whether any
FMC/OTI rule requires the forwarder to be paid directly.

## Post-launch (decided, don't build before launch)

- **Phone video upgrades:** separate Record / Choose buttons, a 60-second
  limit, and moving video to Cloudflare Stream or Mux.

