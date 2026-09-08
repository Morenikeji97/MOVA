-- MOVA Phase 3 — Reviews & ratings
--
-- Two-way reviews for completed buyer<->seller deals, one-directional
-- buyer->shipper reviews, admin moderation queue, and public rating rollups.
--
-- ELIGIBILITY IS ENFORCED IN RLS (WITH CHECK), not just the UI. A review can be
-- inserted only when a real, completed transaction ties the reviewer and the
-- reviewee together — see "reviews insert when eligible" below.
--
-- "Completed" in MOVA:
--   buyer<->seller : purchase_requests.mova_fee_payment_status = 'paid'
--                    (+ seller_details_revealed_at set) — the point the fee is
--                    paid and the seller's contact is released. The status enum
--                    value 'completed' is never set by the app.
--   buyer->shipper : shipment_requests.status = 'completed'
--                    (set by the admin "mark shipment completed" action).
--
-- Touches nothing in the payment webhooks, resolveViewer(), the reservation
-- flow, the chat filter, or the shipper marketplace logic.

create type review_type as enum (
  'buyer_to_seller',
  'seller_to_buyer',
  'buyer_to_shipper'
);
create type review_status as enum ('pending', 'published', 'flagged', 'removed');
create type review_report_status as enum ('open', 'reviewed', 'dismissed');

-- 1. reviews -----------------------------------------------------------------
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  review_type review_type not null,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  -- Polymorphic reviewee: a user (seller / buyer) OR a shipper, never both.
  reviewee_id uuid references public.users(id) on delete cascade,
  reviewee_shipper_id uuid references public.shippers(id) on delete cascade,
  -- Polymorphic transaction: a purchase_request OR a shipment_request. Real FKs
  -- (not a bare uuid) so a deleted transaction can't leave a dangling review.
  purchase_request_id uuid references public.purchase_requests(id) on delete cascade,
  shipment_request_id uuid references public.shipment_requests(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status review_status not null default 'pending',
  moderated_by uuid references public.users(id),
  moderated_at timestamptz,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A reviewer never reviews themselves.
  constraint reviews_no_self check (reviewer_id is distinct from reviewee_id),

  -- The reviewee column set must match the review_type.
  constraint reviews_target_shape check (
    (review_type in ('buyer_to_seller', 'seller_to_buyer')
       and reviewee_id is not null and reviewee_shipper_id is null)
    or
    (review_type = 'buyer_to_shipper'
       and reviewee_id is null and reviewee_shipper_id is not null)
  ),

  -- Exactly one transaction column, matching the review_type.
  constraint reviews_txn_shape check (
    (review_type in ('buyer_to_seller', 'seller_to_buyer')
       and purchase_request_id is not null and shipment_request_id is null)
    or
    (review_type = 'buyer_to_shipper'
       and shipment_request_id is not null and purchase_request_id is null)
  ),

  -- Defence in depth for contact-info in the comment. The submission server
  -- action runs the full shared filter (lib/chat-filter.ts); this coarse CHECK
  -- also catches a review inserted straight through PostgREST.
  constraint reviews_comment_guard check (
    comment is null or (
      char_length(comment) <= 2000
      and comment !~ '[0-9][-. ()0-9]{5,}[0-9]'                                   -- phone-ish digit runs
      and comment !~* '@[a-z0-9._%+-]'                                            -- @handles / emails
      and comment !~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|dev|xyz|info|biz|ng|me|tv|uk|us|ru|link|site))'  -- urls / bare domains
    )
  )
);

-- One review per direction per transaction. reviewee_id is null on shipper
-- reviews, so an expression index (not a plain multi-column UNIQUE, which would
-- treat those nulls as distinct).
create unique index reviews_one_per_direction_per_txn on public.reviews (
  reviewer_id,
  review_type,
  coalesce(purchase_request_id, shipment_request_id),
  coalesce(reviewee_id, reviewee_shipper_id)
);

create index reviews_published_reviewee_idx on public.reviews (reviewee_id)
  where status = 'published' and reviewee_id is not null;
create index reviews_published_shipper_idx on public.reviews (reviewee_shipper_id)
  where status = 'published' and reviewee_shipper_id is not null;
create index reviews_moderation_idx on public.reviews (created_at)
  where status in ('pending', 'flagged');
create index reviews_reviewer_idx on public.reviews (reviewer_id);

create or replace function public.reviews_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.reviews_set_updated_at() from public, anon, authenticated;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.reviews_set_updated_at();

-- 2. review_reports --------------------------------------------------------
create table public.review_reports (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  status review_report_status not null default 'open',
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)   -- one report per user per review
);
create index review_reports_open_idx on public.review_reports (created_at)
  where status = 'open';

-- A new report routes the review into the moderation queue. security definer
-- so it runs regardless of the reporter's (lack of) UPDATE rights on reviews.
create or replace function public.flag_review_on_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reviews
     set status = 'flagged'
   where id = new.review_id
     and status in ('pending', 'published');
  return new;
end $$;
revoke execute on function public.flag_review_on_report() from public, anon, authenticated;
create trigger review_reports_flag_review
  after insert on public.review_reports
  for each row execute function public.flag_review_on_report();

-- 3. Row-Level Security ---------------------------------------------------
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;

-- reviews: published rows are world-readable (public seller / shipper
-- profiles); the reviewer, the reviewee, the reviewed shipper's owner, and
-- admins see everything else.
create policy "reviews public read published" on public.reviews
  for select using (status = 'published');
create policy "reviews party read" on public.reviews
  for select using (
    reviewer_id = auth.uid()
    or reviewee_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.shippers s
      where s.id = reviews.reviewee_shipper_id and s.user_id = auth.uid()
    )
  );

-- reviews INSERT — the eligibility gate. Every branch pins BOTH parties to one
-- real, completed transaction row; the reviewer is always auth.uid(); the row
-- lands 'pending' so a client can't self-publish past moderation.
create policy "reviews insert when eligible" on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and status = 'pending'
    and rating between 1 and 5
    and reviewer_id is distinct from reviewee_id
    and (
      ------------------------------ buyer -> seller ------------------------------
      (
        review_type = 'buyer_to_seller'
        and reviewee_shipper_id is null
        and shipment_request_id is null
        and exists (
          select 1
          from public.purchase_requests pr
          join public.vehicles v on v.id = pr.vehicle_id
          where pr.id = reviews.purchase_request_id
            and pr.buyer_id = auth.uid()
            and v.seller_id = reviews.reviewee_id
            and pr.mova_fee_payment_status = 'paid'
            and pr.seller_details_revealed_at is not null
        )
      )
      -------------------- seller -> buyer (same tx, reversed) -------------------
      or (
        review_type = 'seller_to_buyer'
        and reviewee_shipper_id is null
        and shipment_request_id is null
        and exists (
          select 1
          from public.purchase_requests pr
          join public.vehicles v on v.id = pr.vehicle_id
          where pr.id = reviews.purchase_request_id
            and v.seller_id = auth.uid()
            and pr.buyer_id = reviews.reviewee_id
            and pr.mova_fee_payment_status = 'paid'
            and pr.seller_details_revealed_at is not null
        )
      )
      ----------------------------- buyer -> shipper ----------------------------
      or (
        review_type = 'buyer_to_shipper'
        and reviewee_id is null
        and purchase_request_id is null
        and exists (
          select 1
          from public.shipment_requests sr
          where sr.id = reviews.shipment_request_id
            and sr.buyer_id = auth.uid()
            and sr.shipper_id = reviews.reviewee_shipper_id
            and sr.status = 'completed'
        )
      )
    )
  );

-- Only admins move a review between statuses (publish / remove / dismiss-flag).
-- The report trigger above is the one other writer, and it runs as definer.
create policy "reviews admin moderate" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- review_reports: any signed-in user reports a *published* review that isn't
-- their own; reporter + admin can read; admin resolves.
create policy "review reports insert" on public.review_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.reviewer_id <> auth.uid()
        and (r.status = 'published' or public.is_admin())
    )
  );
create policy "review reports read" on public.review_reports
  for select using (reporter_id = auth.uid() or public.is_admin());
create policy "review reports admin update" on public.review_reports
  for update using (public.is_admin()) with check (public.is_admin());

-- 4. Public rating rollups ------------------------------------------------
-- security_invoker => the querying user's RLS applies. "reviews public read
-- published" lets anyone read published rows, so anon can read the aggregates.
create view public.seller_ratings with (security_invoker = true) as
  select reviewee_id as seller_id,
         round(avg(rating)::numeric, 2) as avg_rating,
         count(*)::int as review_count
  from public.reviews
  where review_type = 'buyer_to_seller' and status = 'published'
  group by reviewee_id;

create view public.buyer_ratings with (security_invoker = true) as
  select reviewee_id as buyer_id,
         round(avg(rating)::numeric, 2) as avg_rating,
         count(*)::int as review_count
  from public.reviews
  where review_type = 'seller_to_buyer' and status = 'published'
  group by reviewee_id;

create view public.shipper_ratings with (security_invoker = true) as
  select reviewee_shipper_id as shipper_id,
         round(avg(rating)::numeric, 2) as avg_rating,
         count(*)::int as review_count
  from public.reviews
  where review_type = 'buyer_to_shipper' and status = 'published'
  group by reviewee_shipper_id;

grant select on public.seller_ratings to anon, authenticated;
grant select on public.buyer_ratings to anon, authenticated;
grant select on public.shipper_ratings to anon, authenticated;
