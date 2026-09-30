# Architecture review: mobile-first readiness

**Date:** 2026-09-30 · **Scope:** `main` at `ffb32da` · **Lens:**
[`mobile-first-requirement.md`](mobile-first-requirement.md)

This review checks the current app against the new mobile-first requirement.
It changes no app code. The `site-black-white-rebrand` work is in flight, so
colour and typography are out of scope here. Everything below is
layout, interaction, data or architecture, and still applies after the rebrand.

## Summary

The foundation is sound. Server components are the default, form fields are
mostly `h-11`, the listing gallery and card grids already collapse to one column,
the one wide admin table scrolls inside its own container, reduced motion is respected, and
shipment proof photos open the rear camera. The gaps are concentrated in
three places:

1. **Data cost of vehicle media.** This is the biggest gap. Full-size uploads (up to 10 MB each) are
   sent to cards and galleries with no resizing or lazy loading, and the Browse page has
   no pagination.
2. **Touch interaction.** Some controls are hover-only, and some tap targets are too small.
3. **Per-request overhead.** Auth lookups in the root layout make every page
   dynamic and duplicate work on the client. The chat polls every 4 s even
   in a background tab.

## Findings

Priority: **P1** = fix before public launch · **P2** = fix soon · **P3** = cleanup.

### P1 — Vehicle photos are served at original size, eagerly

- `components/ui/vehicle-card.tsx:60` and `app/browse/[id]/page.tsx:299` use a
  plain `<img src={mediaUrl(url)}>`. `mediaUrl` (`lib/media-url.ts`) only
  rewrites the host to `/media/…`, and Netlify proxies the untouched original from Storage.
- Uploads allow up to **10 MB per photo** and **20 photos per listing**
  (`components/ui/photo-uploader.tsx:81`, `app/seller/listings/new/page.tsx`).
  The listing page renders every gallery photo at once, with no `loading="lazy"`
  anywhere in the codebase. A single listing view can cost tens of MB of mobile data.
- `next.config.ts` configures `images.remotePatterns`, but `next/image` isn't used
  anywhere, so no optimisation happens.

**Recommendation:** add a `listingImageUrl(url, width)` helper next to
`mediaUrl` that points at Supabase's image-transformation endpoint
(`/storage/v1/render/image/public/…?width=…&quality=…&format=origin`) through a
`/media-render/*` proxy rule in `netlify.toml` and `next.config.ts`. Use it
with `srcSet`/`sizes` on cards (≈480w) and the gallery (≈1080w), and add
`loading="lazy" decoding="async"` to everything but the first gallery image.
(`next/image` with a custom loader is the alternative. Either way, keep the
`/media` same-origin model.) Also consider resizing on the client before
upload (canvas → WebP ≈ 2000px). That cuts seller upload time on mobile data
and storage cost too.

### P1 — Browse has no pagination

`app/browse/page.tsx` selects every approved listing and then loads
thumbnails for all of them (`lib/listings.ts:72`). It's fine at pre-launch
volume, but cost grows with inventory on the page mobile users hit most.
It also runs a second full scan (`select("make")`) just to build the make
dropdown.

**Recommendation:** use `.range()` pagination (24 per page) with a `?page=`
param that the existing filter form preserves. Move the distinct-makes lookup
to a small view or RPC (`select distinct make`) or cache it.

### P1 — Hover-only control in the photo uploader

The remove-photo button in `components/ui/photo-uploader.tsx:244` is
`opacity-0 … group-hover:opacity-100`. On a phone it's invisible, and whether a tap reaches it
depends on the browser. Sellers are the users most likely to be on a phone
here. The up/down/"Make primary" controls next to it are `p-1` with a
14px icon (≈22px tap target).

**Recommendation:** always show the remove button on touch
(`[@media(hover:none)]:opacity-100`) and enlarge all four controls to 44px targets.
The tile can grow on mobile if needed (`grid-cols-2` below `sm`).

### P2 — Root layout makes every page dynamic and doubles auth work

`components/ui/header.tsx` runs `supabase.auth.getUser()` plus a `users`
query on **every** request, just to hide one nav link for buyers. The
middleware (`lib/supabase/middleware.ts`) has already resolved the user and role for
the same request, and `AccountMenu` resolves them again on the client
(`users` + `shippers`). Because the layout reads cookies, no page, including
the marketing and policy pages, can be static or cached at the edge.
`next.config.ts` has to force `no-store` on `/` because of it.

**Recommendation:** make the header static (always render the full nav, or
let `AccountMenu`, which is already client-side, hide "Sell Your Car" for buyers).
Then `/`, `/how-it-works`, `/policies/**`, `/sell` and `/shipper` can be
statically rendered and served from the CDN, which is the biggest single TTFB
win for users far from the origin region. If the role is needed server-side, have the
middleware pass it on a request header instead of querying again.

### P2 — Mobile header layout

- The mobile nav (`header.tsx`, `md:hidden` block) shows **five** links
  (the comment says four) in a wrapping row of `text-sm` links with no padding.
  Each tap target is about 20px tall, and the wrap takes two or three lines
  above the fold on a 360px screen, under the pre-launch banner.
- Signed out, the logo row holds the logo plus "Sign In" plus "Create Account"
  inside `px-6` with `gap-6`, which is tight at 320px.

**Recommendation:** use a menu button (disclosure, not a modal) below `md` that
holds the nav links and Sign In, and keep "Create Account" or "Account" visible.
Give each link a 44px row. Use `px-4` gutters below `sm`.

### P2 — Chat polls every 4 s regardless of visibility

`components/ui/chat-thread.tsx:25,88` polls the full message list every 4 s
for as long as the component is mounted, including in a background tab. It
also refetches the entire conversation on every poll. That's a steady drain on data
and battery.

**Recommendation:** short term, pause when `document.hidden`, back off
to 15–30 s when idle, and fetch only rows newer than the last `created_at`.
Longer term, use Supabase Realtime on `messages` filtered by `conversation_id` (RLS
already scopes reads).

### P2 — Listing video preloads

`app/browse/[id]/page.tsx` renders `<video controls>` with no `preload`
attribute. Some mobile browsers then fetch a sizable chunk of a clip up to 100 MB on page
load. **Recommendation:** add `preload="none"` plus a `poster` (the primary photo).

### P2 — Small-text inputs cause iOS zoom

`app/shipper/portal-rates.tsx:22` and `app/admin/shippers/shipper-admin.tsx:15`
use `h-10 … text-sm` inputs. Shippers set rates from their phones, and iOS zooms
in on focus. **Recommendation:** use `text-base sm:text-sm` and `h-11`. Longer term, add
a shared `inputClasses()` in `components/ui/` next to `buttonClasses()`. Five files each define their own
`inputClass` today, and a shared one would enforce the rule in one place.

### P2 — Keyboard hints on key fields

`type`/`inputMode`/`autoComplete` appear in only about 16 places across the app. Audit the
listing form (price, mileage, year → `inputMode="numeric"`; VIN →
`autoCapitalize="characters" autoCorrect="off" spellCheck={false}`), signup/login
(`autoComplete="email"`, `"new-password"`/`"current-password"`) and WhatsApp
fields (`type="tel" autoComplete="tel"`).

### P3 — Floating WhatsApp button can cover content

`components/ui/whatsapp-button.tsx` is `fixed bottom-4 right-4 h-14 w-14` on
every page. The chat composer's send button and the listing page's
bottom-of-page actions sit in the same corner on a phone. **Recommendation:** add bottom
padding to `<main>` on pages whose last element is an action, or hide the
button on `/seller/messages/**`, `/browse/[id]` while chat is open, and form pages.

### P3 — Page gutters

61 elements use `px-6` and none step up with `px-4 sm:px-6`. On a 320–360px
screen, 24px gutters on each side take roughly 15% of the width. **Recommendation:** fix this
through the shared page container when the header is reworked.

### P3 — Large client pages

25 files under `app/` are `"use client"`, and `app/seller/listings/new/page.tsx`
(893 lines) ships the whole listing form, both uploaders and the VIN decoder
as one client bundle. It works, but it's the heaviest page on the device most
sellers will use. **Recommendation:** keep the page shell a server component and
lazy-load the video and document uploaders (`next/dynamic`) since they're
below the fold. Persist a form draft (`sessionStorage`) so switching to the
camera app and back doesn't lose input.

### P3 — Viewport and theme metadata

`app/layout.tsx` relies on Next's default viewport. That's correct, but add an
explicit `export const viewport` with `themeColor` (the rebrand's header
colour) so the Android browser chrome matches the header. Pick the colour after the rebrand merges.

## What's already right (keep doing it)

- Server components by default, server actions for mutations.
- `h-11` fields on the main public forms (browse filters, listing form, shipper signup).
- Mobile-first grids on the listing page (`grid-cols-1 sm:grid-cols-2`, spec
  `grid-cols-2 sm:grid-cols-3`).
- `overflow-x-auto` around the admin shipments table keeps the page from
  scrolling sideways. Under the operating standard it should become a card
  queue on phones, but it's a sound stopgap until then.
- `capture="environment"` on shipment proof uploads.
- Tap-based reorder alternative to drag in the photo uploader.
- `prefers-reduced-motion` and `:focus-visible` handled globally.
- Same-origin `/media` proxy. The image-resize fix builds on it rather than replacing it.

## Suggested order

1. Photo resizing + lazy loading (P1), then Browse pagination (P1), then the photo
   uploader touch fix (P1). These are independent and can ship as separate PRs.
2. Static header / static marketing pages (P2). Do this after the rebrand merges,
   because the rebrand touches `header.tsx`.
3. Mobile header menu + `px-4` gutters (P2/P3), together with step 2.
4. Chat polling, video preload, input sizing and keyboard hints (P2): small, separate PRs.

## Pending CLAUDE.md change (apply after the rebrand merges)

There's no `CLAUDE.md` on `main` or on `site-black-white-rebrand` yet.
Once the rebrand merges, create `CLAUDE.md` at the repo root with this
section, or add it if the rebrand introduces one:

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
