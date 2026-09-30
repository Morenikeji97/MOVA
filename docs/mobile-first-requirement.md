# ShipMova operating standard

**Status:** Adopted · applies to every new or changed page, component and flow.

The brand is **ShipMova**. Never use "MOVA" in anything user-facing.

## Goals

1. **The founder and staff can run about 95% of daily operations from a phone.**
   - ShipMova is the single source of truth for every transaction. Each one
     has an ID (`SM-000001`) and a full stage history.
   - Exceptions surface in an **Action Required** queue.
   - Admin screens are mobile-first cards and queues, not shrunken tables.
2. **Buyers and sellers get fast, light pages.** Assume many of them are on
   Android phones and metered mobile data. Buyers are mostly in Nigeria.
   Sellers and shippers often use a phone too, photographing a car or a
   pickup in a driveway.

So the phone is the primary target, for staff as well as customers.
Desktop is the enhancement.

## Before building or changing anything, answer

1. Does it work properly on mobile?
2. Does it keep ShipMova as the source of truth?
3. Does it fit the transaction lifecycle? Stages are data-driven, not hard-coded.
4. Does it write the audit trail for admin and sensitive actions?
5. Are permissions enforced server-side or by RLS? Never UI-only.
6. Does it open a security hole? Sensitive actions need reauth or MFA.
7. Can staff use it without the founder?
8. Can it scale without a rebuild?
9. Is it needed now, or is it over-building before launch?

## Payments

ShipMova never custodies vehicle funds. The car price goes through Escrow.com.

---

The rest of this document is the mobile engineering rule set. The findings
that led to it, and the current gaps against it, are in
[`architecture-review.md`](architecture-review.md).

---

## 1. Design and build at 360px first

- Write unprefixed Tailwind classes for the phone layout, and add `sm:` /
  `md:` / `lg:` only to widen it. Don't start from a desktop layout and
  patch it with `max-*:` or hide things below a breakpoint.
- Target widths are **360 × 740** (the most common Android viewport in
  Nigeria) as the baseline and **320px** as the minimum that must not break.
- No horizontal page scroll at 320px. Lists of records (transactions,
  shipments, listings, and admin queues especially) are cards below `sm`,
  not tables. A table may appear from `md` up. A scrolling `overflow-x-auto`
  table is only a stopgap for dense reference data such as rate grids.
- Multi-column grids start at 1 column (or 2 for small thumbnails) and grow:
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Page gutters are `px-4` on phones (`sm:px-6` and up). Keep content inside
  the existing `max-w-6xl` container.

## 2. Touch, not hover

- Every interactive element has a tap target of at least **44 × 44 px**
  (`h-11` / `min-h-11`, or padding to reach it). This includes nav links,
  icon buttons, and the small reorder/remove controls inside cards.
- Nothing is reachable **only** on hover. `opacity-0 group-hover:opacity-100`
  is not allowed for a control. Show it always, or reveal it with
  `focus-within` as well and keep it visible on touch devices (`[@media(hover:none)]:opacity-100`).
- Drag-and-drop always has a tap alternative (the photo uploader's up/down
  buttons are the pattern to follow).
- Leave 8px or more between adjacent tap targets.
- Content and sticky/fixed UI never overlap. The floating WhatsApp button
  occupies the bottom-right corner, so primary actions and page-bottom
  controls keep clear of it (e.g. `pb-20` on pages with a bottom action bar).

## 3. Forms that work on a phone keyboard

- Inputs, selects and textareas use **16px (`text-base`) or larger** text. Anything
  smaller makes iOS Safari zoom the page on focus. `text-sm` is fine for
  labels and help text, not for the field itself.
- Field height is `h-11` (44px) or larger.
- Set the right keyboard and autofill on every field: `type="email"`,
  `type="tel"` + `autoComplete="tel"` for WhatsApp numbers,
  `inputMode="numeric"` for price / mileage / year, `autoCapitalize="characters"`
  + `autoCorrect="off"` + `spellCheck={false}` for VINs, and
  `autoComplete` tokens for name, address and password fields.
- Labels sit above fields, not beside them. One column below `sm`.
- File inputs that expect a photo of something in front of the user offer the
  camera: `accept="image/*"` and, where a live photo is what we want,
  `capture="environment"` (as `shipment-proof-uploader.tsx` does).
- Errors appear next to the field and the first invalid field is scrolled
  into view and focused on submit.

## 4. Data budget

Treat every byte as the buyer's money.

- **Images:** never send an original upload to a listing card or gallery.
  Serve resized variants (card thumbnail ≈ 480px wide, gallery ≈ 1080px wide,
  WebP/AVIF). Use `next/image` with `sizes`, or Supabase Storage image
  transformations behind the `/media` proxy.
- Every image below the first screen gets `loading="lazy"` and
  `decoding="async"`, plus explicit `width`/`height` or an `aspect-*` box so
  the layout doesn't shift.
- **Video:** `preload="none"` (or `"metadata"`) with a `poster`. Video never
  autoplays.
- **Lists are paginated.** No page renders an unbounded query result. The default is
  12–24 items per page with "Load more" or numbered pages.
- **Polling:** anything that polls (chat) pauses when
  `document.visibilityState === "hidden"` and backs off when idle. Prefer
  Supabase Realtime over polling for new work.
- Client JavaScript is a cost. Default to server components. Add
  `"use client"` only for the smallest interactive leaf, not for a whole page.
- Budget per public page on a cold load (Browse, Listing, Home):
  **≤ 200 KB JS (gzipped)** and **≤ 1 MB total transfer** before
  the user scrolls.

## 5. Performance targets

Measured with Lighthouse mobile emulation (Moto G Power, Slow 4G) on the
production build:

| Metric | Target |
| --- | --- |
| Largest Contentful Paint | ≤ 2.5 s |
| Interaction to Next Paint | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Lighthouse Performance (mobile) | ≥ 85 on `/`, `/browse`, `/browse/[id]` |

## 6. Resilience on flaky networks

- Every form submit shows a pending state and disables the button, so a slow
  network doesn't produce double submits.
- Uploads show progress, survive a single failed request (retry), and never
  lose the rest of the form if one file fails.
- A failed fetch shows a retry, not a blank area.
- Long forms (the listing form) don't lose input if the user switches apps to take a photo
  and the tab is reloaded. Persist drafts where practical.

## 7. Definition of done for UI changes

A UI pull request is not ready for review until the author has:

1. Checked it at **360px** and **320px** wide (DevTools device mode is fine),
   plus one desktop width.
2. Confirmed there's no horizontal scroll, no hover-only control, and no
   tap target under 44px.
3. Confirmed form fields are `text-base` and use the right `type` /
   `inputMode` / `autoComplete`.
4. For pages that show photos, video or lists, confirmed images are lazy and
   resized and lists are paginated.
5. Noted the mobile check in the PR description ("Checked at 360/320/1280").

Admin and staff pages (`/admin/**`) are held to the same mobile rules,
because staff run operations from a phone. They're exempt only from the
public-page performance targets in section 5. Paginate them and resize
their images like everything else.
