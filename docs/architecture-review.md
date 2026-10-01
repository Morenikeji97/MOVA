# Architecture review: ShipMova operating standard

**Date:** 2026-09-30 · **Scope:** `main` at `ffb32da` (code and all 45
migrations) · **Lens:** [`mobile-first-requirement.md`](mobile-first-requirement.md)

This review checks the current app against the ShipMova operating standard. It
changes no app code.

- **Part 1** covers page performance and mobile UX for buyers and sellers.
- **Part 2** covers running operations from a phone: transactions, audit,
  access control, notifications, search, documents and currency.

Everything is sorted into four buckets:

| Bucket | Meaning |
| --- | --- |
| **MVP NOW** | Before the first real transaction, or cheap enough that waiting costs more than doing |
| **AFTER 20** | After the first 20 transactions, once real usage shows where it hurts |
| **AROUND 100** | Volume or first staff make it necessary |
| **SCALE** | Multiple countries, currencies or a larger team |

The rebrand in flight is on branch `rebrand-shipmova`, which isn't on the
remote yet. The older `site-black-white-rebrand` branch is superseded. Colour
and typography are left to the rebrand. Everything here is layout,
interaction, data or architecture, and still applies after it merges.

## Summary

**Buyers and sellers (Part 1).** The foundation is sound: server components
by default, `h-11` fields, one-column grids on phones, reduced motion
respected. The biggest gap is vehicle photos. Originals of up to 10 MB each are
served to cards and galleries with no resizing or lazy loading. Supabase is on the Free plan,
where image transformations aren't available, so the fix is to **resize photos
in the browser before upload and store a thumbnail variant** (see 1.1).

**Operations from a phone (Part 2).** The schema is further along than it
looks, but none of it is wired up:

- `transaction_status_history`, `admin_actions_log` and `notifications`
  tables all exist (migration 0001), but **no code or trigger ever writes to
  them**.
- `users.role` is already an enum (`buyer | seller | admin`). `is_admin()`
  is a SQL helper over it, not a separate flag.
- There is **no transaction reference** (`SM-000001`). The escrow leg
  (Escrow.com funded → inspected → released) **isn't recorded anywhere**.
  A transaction's state is split across five status columns on three tables.
- There is **no MFA** on any account, including admin accounts that can
  approve bank transfers, decide refunds and charge shippers' saved cards.

**Smallest changes to make now so the future isn't blocked:**

| Your proposal | Verdict |
| --- | --- |
| Transaction ID + stage-history table | **Agree, adjusted.** The history table exists. Add the `SM-` reference to `purchase_requests`, widen history to a text `stage` code, and write it from a trigger. |
| Admin audit log | **Agree, adjusted.** The table exists. Write to it from one server-side helper (triggers can't see the actor on service-role writes), and make it append-only. |
| Role column replacing `is_admin` | **Disagree for now.** The role column already exists. Adding staff roles before the first hire is over-building. Consolidating the 10 separate admin checks into one helper *now* is enough to make that change painless later. |
| *(added)* MFA on admin accounts | **Do now.** TOTP MFA is free on every Supabase plan and is the single biggest security gap. |
| *(added)* Escrow stage fields | **Do now.** Without them, ShipMova isn't the source of truth for the part of the deal that matters most. |
| *(added)* Link every shipment to its transaction | **Do now.** `shipment_requests.purchase_request_id` is nullable. |

Details are in [Smallest changes to make NOW](#smallest-changes-to-make-now).

## Plan by bucket

| Bucket | Item | Part |
| --- | --- | --- |
| **MVP NOW** | Transaction reference `SM-000001` + stage history written by trigger | 2.1 |
| | Escrow stage fields (manual entry by admin; no Escrow.com API yet) | 2.2 |
| | Every shipment linked to its transaction | 2.1 |
| | Admin audit log: one `logAdminAction()` helper, append-only | 2.5 |
| | MFA (TOTP) required for admin accounts | 2.7 |
| | Mobile transaction page `/admin/transactions/[ref]` (read-only timeline) | 2.4 |
| | Action Required v1: one list derived from existing states | 2.3 |
| | One `requireAdmin()` helper replacing 10 copies | 2.6 |
| | Photo resize in the browser + thumbnail variant; lazy loading | 1.1 |
| | Photo uploader touch fix (hover-only remove button) | 1.3 |
| | Video `preload="none"`; chat polling pauses in background tabs | 1.6, 1.7 |
| | 16px inputs on shipper rates and admin shipper forms | 1.8 |
| **AFTER 20** | Staff roles (first hire): `staff_role` + permission helper | 2.6 |
| | Reauthentication for money-moving actions | 2.7 |
| | In-app notifications (write to the existing table) + admin daily digest | 2.8 |
| | Browse pagination (or sooner, once there are more than ~48 live listings) | 1.2 |
| | Static header / cacheable marketing pages (after rebrand merges) | 1.4 |
| | Mobile header menu, `px-4` gutters, keyboard hints, WhatsApp button overlap | 1.5, 1.9–1.11 |
| **AROUND 100** | Stage definitions table (labels, owner, SLA) driving the Action Required queue | 2.2, 2.3 |
| | Global search (reference, VIN, email, name) | 2.9 |
| | Document index across the six storage buckets | 2.10 |
| | Supabase Realtime for chat; split the listing-form client bundle | 1.7, 1.12 |
| | Upgrade to Supabase Pro (backups, no project pausing, image transforms) | 1.1 |
| **SCALE** | Multi-currency and multi-country | 2.11 |
| | Fine-grained permissions table; per-role dashboards | 2.6 |
| | WhatsApp notifications, notification preferences | 2.8 |

---

## Smallest changes to make NOW

These are small migrations plus a handful of helpers. None of them builds a
feature ahead of need. Each one stops a later rebuild.

### 1. Transaction reference and stage history — agree

`purchase_requests` is already the transaction root: disputes, reviews,
history and shipments all reference it. **Keep it as the root.** Don't
create or rename to a new `transactions` table; that's a rebuild of every
policy and trigger in migrations 0003–0040. If the name matters, add a
`transactions` view later.

1. Add `reference text unique not null`, filled from a sequence as
   `'SM-' || lpad(nextval(...)::text, 6, '0')`, and backfill existing rows.
2. Change `transaction_status_history.status` from the
   `purchase_request_status` enum to `stage text` plus `from_stage text`.
   Stage codes then stay plain data, and adding the escrow and shipping stages doesn't need
   `alter type` each time.
3. Write history from an `AFTER UPDATE` trigger (`security definer`) on
   `purchase_requests`. Also fire it on `shipment_requests.shipping_status`
   and `disputes.status`, keyed back to the purchase request. Record
   `changed_by = auth.uid()` or the actor passed by the helper (see 4).
4. Drop the `"transaction history admin insert"` policy so history can only
   come from the trigger, and change the FK to `on delete restrict` so history
   can't be cascade-deleted.
5. Make `shipment_requests.purchase_request_id` required for new rows
   (`check (purchase_request_id is not null) not valid`, then validate after
   backfilling).

### 2. Escrow stage fields — added

Add to `purchase_requests`: `escrow_reference text`, and stage codes in history
for `escrow_opened`, `escrow_funded`, `inspection_passed`, `handed_to_shipper`,
`escrow_released`. At MVP an admin records these from the phone after
checking Escrow.com. An Escrow.com API/webhook integration can come later without a
schema change. ShipMova still never holds vehicle funds. These fields only
record what Escrow.com reports.

### 3. Admin audit log — agree, but not trigger-only

`admin_actions_log` exists with read and insert policies for admins and no
update or delete policy, so it's already append-only for normal sessions. Two
problems:

- **Nothing writes to it.**
- **Triggers can't be the whole answer.** Three admin paths use the
  service-role client (`app/admin/reservations/actions.ts`,
  `app/admin/shipments/actions.ts`, `app/admin/listings/page.tsx`), where
  `auth.uid()` is null. A trigger would log "someone".

Add one `logAdminAction({ actorId, action, targetTable, targetId, before, after, reason })`
helper in `lib/`, written with the service-role client, and call it from every
admin server action. Add `before`/`after jsonb` and `ip` columns. Revoke
`update`/`delete` on the table from `authenticated`, and document that the
service role must never delete from it.

### 4. Roles — disagree with replacing now

There is no `is_admin` column. `users.role` is a `user_role` enum
(`buyer | seller | admin`), guarded against self-promotion by migration 0010,
and `public.is_admin()` reads it. What's missing is *staff*: people who can
run operations without being full admins. There are no staff yet, so adding
roles now is over-building.

What does block the future is that the admin check is copy-pasted into **10
files** (`requireAdmin()` or inline `role === "admin"`). **Now:** move it into
one `lib/auth/require-staff.ts` that every admin action and page calls, and keep
`is_admin()` as the single database chokepoint. **At the first hire (AFTER 20):**
add a nullable `staff_role` enum (`ops`, `finance`, `support`) and a
`has_staff_permission(action)` function. Only those two functions change.

### 5. MFA on admin accounts — added

Supabase Auth TOTP MFA is available on the Free plan. Require `aal2` for
`/admin/**` in `middleware.ts`, and make `is_admin()` also require
`auth.jwt() ->> 'aal' = 'aal2'` so RLS enforces it too, not just the UI.

### 6. Money-column convention — rule only, no migration

Every money column is named `*_usd` today. Don't migrate them. From now on, new
money columns are `amount numeric(12,2)` plus `currency char(3)`
(`shipment_requests` already follows this). That one rule keeps
multi-currency a SCALE task instead of a rebuild.

---

## Part 1: page performance and mobile UX

### 1.1 Vehicle photos are served at original size, eagerly — MVP NOW

- `components/ui/vehicle-card.tsx:60` and `app/browse/[id]/page.tsx:299` use a
  plain `<img src={mediaUrl(url)}>`. `mediaUrl` (`lib/media-url.ts`) only
  rewrites the host to `/media/…`, and Netlify proxies the untouched original.
- Uploads allow **10 MB per photo** and **20 photos per listing**. The listing
  page renders every photo at once, and there's no `loading="lazy"` anywhere in the
  codebase. A single listing view can cost tens of MB of mobile data.
- It also costs ShipMova: every view pulls originals out of Supabase Storage,
  and the Free plan includes 5 GB of egress per month.

**Supabase image transformations are not an option on the Free plan.**
Verified against Supabase's docs: *"Image Resizing is currently enabled for
Pro Plan and above"*, with a quota of 100 origin images per month on Pro and
$5 per 1,000 after that. The `/storage/v1/render/image/…` approach from the
first version of this review is withdrawn.

**Recommendation: resize in the browser before upload, and store a thumbnail variant.**

- In `components/ui/photo-uploader.tsx`, decode each file with
  `createImageBitmap` and draw it to a canvas. Upload two WebP files:
  - `…/full.webp`: long edge ≈ 1600px, quality ≈ 0.8, typically 200–400 KB.
  - `…/thumb.webp`: long edge ≈ 480px, typically 30–60 KB.
- Store `thumb_url` alongside `url` in `vehicle_photos` (one nullable column).
  Cards use the thumbnail. The gallery uses the full image with `loading="lazy"` on
  everything after the first photo.
- For photos already uploaded, fall back to the original until the seller re-saves.
- Why this over the alternatives:
  - It costs nothing, needs no plan upgrade, and works the same on every host.
  - Sellers on mobile data upload about 300 KB instead of 5–10 MB per photo,
    which makes the listing form faster and more reliable where it hurts most.
  - It cuts Supabase storage and egress use at the same time.
- Caveat: iPhone HEIC photos can't be decoded on Android or desktop Chrome. The
  bucket only accepts JPEG, PNG and WebP today, and iOS converts to JPEG on
  upload from Safari, so nothing changes there.

**Netlify Image CDN as a second layer (optional, later).** Every Netlify site
has `/.netlify/images` (resize and WebP/AVIF conversion, cached at the edge),
and `next/image` uses it automatically on Netlify. To keep the ShipMova-only
address, add a rewrite such as `/img/*` → `/.netlify/images?url=<Supabase public URL>/:splat&w=…`
with the Supabase host allowlisted under `[images] remote_images`. Two cautions:

- The edge cache is cleared on every deploy, so each deploy re-fetches
  originals from Supabase (egress).
- Check whether transformations count against the current Netlify plan's
  included usage.

Treat it as a later optimisation, not a replacement for resizing at upload.

### 1.2 Browse has no pagination — AFTER 20 (or at ~48 live listings)

`app/browse/page.tsx` loads every approved listing, plus thumbnails for all of
them (`lib/listings.ts:72`), plus a second full scan to build the make
dropdown. It's fine at pre-launch volume. Add `.range()` pagination (24 per page)
and a `select distinct make` view once there are more than two pages of inventory.

### 1.3 Hover-only control in the photo uploader — MVP NOW

The remove-photo button (`components/ui/photo-uploader.tsx:244`) is
`opacity-0 group-hover:opacity-100`, so it's invisible on a phone. The
reorder and "Make primary" buttons next to it are about 22px tap targets. Always
show the remove button on touch (`[@media(hover:none)]:opacity-100`) and
enlarge all four controls to 44px. Do this together with 1.1, because both change the same component.

### 1.4 Root layout makes every page dynamic — AFTER 20

`components/ui/header.tsx` runs `auth.getUser()` plus a `users` query on
every request just to hide one nav link for buyers. The middleware has
already resolved the same user, and `AccountMenu` resolves them again on the client.
Because the layout reads cookies, no page can be cached at the edge. Let `AccountMenu`
hide the link instead, and make `/`, `/how-it-works`, `/policies/**`, `/sell` and `/shipper`
static. Wait until `rebrand-shipmova` merges, since it touches `header.tsx`.

### 1.5 Mobile header layout — AFTER 20

The mobile nav shows five `text-sm` links (the code comment says four) with
tap targets about 20px tall, wrapping onto two or three lines under the
pre-launch banner. Use a menu button below `md` with 44px rows, and keep Account
visible. Do it with 1.4.

### 1.6 Listing video preloads — MVP NOW

`<video controls>` on `app/browse/[id]/page.tsx` has no `preload`, so some mobile
browsers start fetching a clip of up to 100 MB on page load. Add `preload="none"` and a
`poster`. It's a one-line change.

### 1.7 Chat polls every 4 s regardless of visibility — MVP NOW (pause) · AROUND 100 (Realtime)

`components/ui/chat-thread.tsx:25,88` refetches the whole conversation every
4 s, even in a background tab. **Now:** pause while `document.hidden`, back
off to 15–30 s when idle, and fetch only newer rows. **Later:** switch to Supabase Realtime
(the Free plan includes it, but it's not needed at low volume).

### 1.8 Small-text inputs cause iOS zoom — MVP NOW

`app/shipper/portal-rates.tsx:22` and `app/admin/shippers/shipper-admin.tsx:15`
use `h-10 text-sm` inputs. Change them to `text-base sm:text-sm h-11`, and add a shared
`inputClasses()` next to `buttonClasses()`.

### 1.9 Keyboard hints — AFTER 20

Add `inputMode="numeric"` to price, mileage and year fields. VIN fields get
`autoCapitalize="characters" autoCorrect="off"`, and auth and WhatsApp fields get the correct
`autoComplete` tokens.

### 1.10 Floating WhatsApp button covers content — AFTER 20

The `fixed bottom-4 right-4` button sits over the chat send button and
end-of-page actions on a phone. Hide it on chat and form pages, or pad `<main>`.

### 1.11 Page gutters — AFTER 20

61 elements use `px-6` and none use `px-4 sm:px-6`. Fix this in the shared container along with 1.5.

### 1.12 Large client bundle on the listing form — AROUND 100

`app/seller/listings/new/page.tsx` (893 lines) is a single client component.
Lazy-load the video and document uploaders, and persist a draft so switching
to the camera app doesn't lose input.

### 1.13 Viewport theme colour — AFTER 20

Add `export const viewport = { themeColor }` once the rebrand fixes the header colour.

---

## Part 2: operations from a phone

Status key: **Exists** · **Partial** · **Missing**.

### 2.1 Transaction ID and stage history — Partial

- **Exists:**
  - `purchase_requests` is the de facto transaction, and disputes and reviews
    reference it.
  - `transaction_status_history` (0001) has the right shape: request, status,
    `changed_by`, note, timestamp.
- **Missing:**
  - There's no human reference. Staff and buyers can only identify a deal by its UUID.
  - Nothing writes history: no code path or trigger inserts a row. The
    table is empty in every environment.
  - History uses the `purchase_request_status` enum, which covers only the
    reservation phase.
- **Blockers:** state is spread across `purchase_requests.status`,
  `mova_fee_payment_status`, `negotiated_price_status`,
  `shipment_requests.shipping_status` and `disputes.status`, and
  `shipment_requests.purchase_request_id` is nullable (0016). There's no single timeline to show.
- **Security:**
  - Any admin can insert arbitrary history rows (policy `"transaction history admin insert"`), so history can be forged.
  - Rows cascade-delete with their purchase request, so history can be erased.
- **Bucket:** MVP NOW. See [change 1](#1-transaction-reference-and-stage-history--agree).

### 2.2 Lifecycle matching the escrow flow — Partial

- **Exists:** reservation → review → verified → completed/cancelled/expired,
  fee payment (Stripe or bank transfer with manual verification), negotiated
  price, shipment pickup → transit → delivered, disputes, and auto-release of
  stale reservations (0020, 0021).
- **Missing:**
  - The Escrow.com leg isn't recorded: there's no escrow reference and no
    funded, inspected or released stage. The buyer dashboard tells buyers the
    escrow transaction "appears here", but nothing stores it.
  - Stages are hard-coded in enums and repeated in trigger guards (0011, 0014,
    0020 and 0040 each re-list allowed transitions).
- **Blockers:** every new stage today means an `alter type` plus editing a
  guard trigger that's been rewritten four times. That's the "hard-coded"
  problem the standard warns about.
- **Security:** the guard triggers are good. They stop buyers and sellers from
  moving their own deal forward. Keep that model.
- **Bucket:**
  - MVP NOW: escrow fields and text stage codes in history ([change 2](#2-escrow-stage-fields--added)).
  - AROUND 100: a `transaction_stages` table (code, label, order, owner role, SLA hours) that
    the queue and timeline read from.
  - Don't build a generic workflow engine.

### 2.3 Action Required queue — Missing

- **Exists:** `app/admin/dashboard/page.tsx` shows ten counts (pending
  listings, open reservations, pending shippers, disputes, review queue and so on). Each links to
  a separate page.
- **Missing:** one list of "things waiting on ShipMova", oldest first, each
  with a reason and a single action.
- **Blockers:** without a reference and stage history, the queue can't say
  how long something has been waiting.
- **Bucket:**
  - MVP NOW: a v1 SQL view that unions the existing states: bank transfer
    awaiting verification, reservation submitted more than 24 h ago, dispute
    open, listing pending review, shipment delivered but not completed. Each row
    returns `reference`, `reason` and `since`.
  - AROUND 100: SLA timers from the stages table.

### 2.4 Mobile transaction view — Missing

- **Exists:** `/admin/reservations` is already a card list (`<ul>`/`<li>` with
  `grid-cols-2 sm:grid-cols-3` detail rows), which is the right pattern.
  `/admin/shipments` is a table inside `overflow-x-auto` (a stopgap).
- **Missing:** a single page per transaction showing the buyer, seller, vehicle, fee, escrow,
  shipment, dispute, documents and timeline together.
- **Bucket:** MVP NOW. Build `/admin/transactions/[ref]` as a read-only timeline
  first, then add actions. Convert `/admin/shipments` to cards AFTER 20.

### 2.5 Audit log — Partial (table only)

- **Exists:** `admin_actions_log` (0001), readable and insertable by admins,
  with no update or delete policy.
- **Missing:** any writer. Admin approvals, rejections, bank-transfer decisions,
  refund decisions, shipper charges and listing reviews leave no record of who
  did what, apart from a few `*_reviewed_by` columns.
- **Security:** three admin paths use the service-role client, which bypasses
  RLS and has no `auth.uid()`. That's exactly where an audit record matters most.
- **Bucket:** MVP NOW ([change 3](#3-admin-audit-log--agree-but-not-trigger-only)).

### 2.6 Role-based access — Partial

- **Exists:**
  - `users.role` enum (`buyer | seller | admin`).
  - `is_admin()` used across RLS.
  - Migration 0010 stops users promoting themselves.
  - The middleware guards `/admin`, `/seller` and `/buyer` by role.
  - Server actions re-check the role, and RLS enforces it again. Permissions are
    enforced server-side, not just in the UI.
- **Missing:**
  - Staff roles. Anyone who helps with operations must be a full admin.
  - A shipper isn't a role; it's a `shippers` row claimed by email match
    (`app/shipper/actions.ts:70`).
- **Blockers:** the admin check is duplicated in 10 files.
- **Security:** a single admin tier means every helper can see KYC data and title
  documents, decide refunds and charge cards.
- **Bucket:**
  - MVP NOW: consolidate the check ([change 4](#4-roles--disagree-with-replacing-now)).
  - AFTER 20: `staff_role`.
  - SCALE: a permissions table.

### 2.7 MFA and reauthentication — Missing

- **Exists:** nothing. There are no `mfa`, `aal` or reauthentication calls anywhere.
- **Security:** this is the highest-risk gap. One phished admin password can:
  - approve a fake bank transfer,
  - decide dispute refunds,
  - charge a shipper's saved card off-session (`app/admin/shipments/actions.ts`),
  - read KYC data and title documents.

  Admins will be on phones, often on shared or public networks.
- **Bucket:**
  - MVP NOW: TOTP MFA required for admins, enforced in the middleware and in `is_admin()`.
  - AFTER 20: fresh reauthentication (`aal2` within the last 10 minutes) for
    money-moving actions and role changes.

### 2.8 Notifications — Partial

- **Exists:** `lib/notifications.ts` sends email through Resend for 8 events
  (chat, fee paid, reservation expired, price proposed, bank transfer
  rejected, review, dispute filed and decided). Chat email is debounced. Sending
  never throws, so a failed email can't break the action that triggered it.
- **Missing:**
  - The `notifications` table (0001) is never written, so there's no in-app inbox or badge.
  - Admins get no alerts. Nothing tells the founder that a bank transfer is waiting.
  - WhatsApp, where Nigerian buyers actually are, isn't used.
  - Sending is inline in server actions, with no retry or outbox.
- **Bucket:**
  - AFTER 20: write each event to `notifications` as well as sending it, and
    send a daily admin digest built from the Action Required view.
  - SCALE: WhatsApp and notification preferences.

### 2.9 Global search — Missing

- **Exists:** browse filters (make and price), and exact email matching for
  shipper claims. Nothing else.
- **Blocker:** there's no reference to search by (2.1).
- **Bucket:** AROUND 100. Add one admin search box that checks `SM-` references,
  VINs, email, name and phone with `pg_trgm`. Until then, the Action Required
  list plus the reference column covers daily use.

### 2.10 Document management — Partial

- **Exists:**
  - Six storage buckets: `vehicle-photos`, `vehicle-videos`,
    `bank-transfer-proofs`, `dispute-evidence`, `shipment-proof-photos` and
    `vehicle-title-photos`.
  - `vehicle_documents` with `admin_only`/`public` visibility.
  - Signed URLs for private files through `/media-signed`.
- **Missing:** a per-transaction view of every document. Each document type is
  stored differently: dispute evidence is a `text[]` of paths, bank proof is a
  column, and shipment proof has its own table.
- **Security:** private buckets and signed URLs are the right model. Access to
  private documents isn't logged.
- **Bucket:** AROUND 100. Add a `documents` index table (transaction, kind, bucket,
  path, uploaded_by, visibility) that each uploader writes to. Until then, the
  transaction page (2.4) can gather documents from the existing places.

### 2.11 Multi-currency and multi-country — Missing (by design)

- **Exists:**
  - USD everywhere (`*_usd` columns, `Intl.NumberFormat("en-US", USD)`).
  - `shipment_requests.currency` (default `USD`).
  - `buyer_profiles.country` (default `NG`) and `seller_profiles.country` (default `US`).
  - Nigeria-specific import rules in `lib/import-rules.ts`.
  - The waitlist already accepts NG, GH, TG and BJ.
- **Blockers:** none today, as long as new money columns follow the
  [change 6](#6-money-column-convention--rule-only-no-migration) rule.
- **Bucket:** SCALE. Before launching a second country, move import rules to a per-country
  table and add a destination country to the transaction.

---

## What's already right (keep doing it)

- Server components by default, and server actions for mutations.
- Permissions checked three times over: middleware, server action, and RLS.
- Guard triggers stop buyers and sellers from changing admin-owned fields,
  and `users.role` is protected from self-promotion.
- Private buckets plus signed URLs for sensitive documents.
- Notifications never throw, so email failures can't break an action.
- `/admin/reservations` is already a mobile card list.
- `h-11` fields on the main public forms, and mobile-first grids on the listing page.
- `capture="environment"` on shipment proof uploads, and tap-based photo reordering.
- `prefers-reduced-motion` and `:focus-visible` handled globally.
- A same-origin `/media` proxy.

## CLAUDE.md change (applied — now in `CLAUDE.md` at the repo root)

There's no `CLAUDE.md` on `main` yet. Once the rebrand merges, create it at the
repo root with this section, or add it if the rebrand introduces one:

```markdown
## ShipMova operating standard (required) — full text: docs/mobile-first-requirement.md
Brand is "ShipMova" — never "MOVA" in anything user-facing.

Two goals:
1. The founder and staff can run ~95% of daily operations from a phone: ShipMova is the single source of truth for every transaction (ID "SM-000001", full stage history), exceptions surface in an Action Required queue, and admin screens are mobile-first cards/queues, not shrunken tables.
2. Buyers and sellers (assume many on Android phones and metered data) get fast, light pages.

Before building or changing anything, answer:
1. Does it work properly on mobile?
2. Does it keep ShipMova as the source of truth?
3. Does it fit the transaction lifecycle (stages are data-driven, not hard-coded)?
4. Does it write the audit trail for admin/sensitive actions?
5. Are permissions enforced server-side / by RLS (never UI-only)?
6. Does it open a security hole (sensitive actions need reauth/MFA)?
7. Can staff use it without the founder?
8. Can it scale without a rebuild?
9. Is it needed now, or is it over-building before launch?

Payments: ShipMova never custodies vehicle funds — the car price goes through Escrow.com.

Mobile engineering rules:
- Build the 360px layout first with unprefixed Tailwind classes; widen with
  sm:/md:/lg:. Nothing may scroll horizontally at 320px.
- Tap targets ≥ 44px (h-11). No hover-only controls.
- Form fields use text-base (16px) or larger, plus the right type / inputMode / autoComplete.
- Never serve original uploads to cards or galleries: use resized images,
  loading="lazy", video preload="none". Paginate every list.
- Server components by default; "use client" only on the smallest
  interactive leaf. Anything that polls pauses when the tab is hidden.
- Before calling a UI change done, check it at 360px, 320px and one desktop
  width, and say so in the PR description.

Known gaps and priorities: docs/architecture-review.md.
```
