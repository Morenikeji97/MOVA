-- MOVA Phase 2 — Buyer <-> seller in-platform chat
--
-- A buyer can message the seller from any approved listing without reserving
-- first. One conversation per (vehicle, buyer); the seller replies from a
-- "Messages" section in their dashboard.
--
-- Contact-info sharing is blocked in the app layer (lib/chat-filter.ts) before
-- a message is delivered. A blocked message is still written, flagged
-- blocked_attempt = true, so admins can watch for repeat circumvention — RLS
-- hides those rows from both participants. All message writes go through the
-- chat server actions with the service role (there is no INSERT policy), so the
-- filter cannot be bypassed with a raw client.
--
-- Touches nothing in the payment webhooks, resolveViewer(), auth/cache
-- handling, the reservation flow, or the shipper marketplace.

create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  -- Per-participant read cursors drive the seller's unread indicators. Written
  -- only by the chat server actions (service role); no UPDATE policy exists.
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (vehicle_id, buyer_id),
  constraint conversations_distinct_parties check (buyer_id <> seller_id)
);

create index conversations_seller_idx
  on public.conversations (seller_id, created_at desc);
create index conversations_buyer_idx
  on public.conversations (buyer_id, created_at desc);
create index conversations_vehicle_idx on public.conversations (vehicle_id);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  -- true => contact-info filter tripped; logged for admins, never delivered.
  blocked_attempt boolean not null default false,
  created_at timestamptz not null default now()
);

-- Thread reads (participants) only ever want the delivered messages.
create index messages_delivered_idx
  on public.messages (conversation_id, created_at)
  where blocked_attempt = false;
-- Admin monitoring view wants the blocked ones, newest first.
create index messages_blocked_idx
  on public.messages (created_at desc)
  where blocked_attempt = true;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations --------------------------------------------------------------
-- Read: the two participants + admin.
create policy "conversations participant read" on public.conversations
  for select using (
    buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin()
  );
-- Insert: a buyer opens their own conversation, and only against an approved
-- vehicle whose seller_id matches the row. No self-conversations.
create policy "conversations buyer insert" on public.conversations
  for insert with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and exists (
      select 1 from public.vehicles v
      where v.id = conversations.vehicle_id
        and v.seller_id = conversations.seller_id
        and v.status = 'approved'
    )
  );
-- No UPDATE / DELETE policy: read cursors are bumped by the chat server
-- actions with the service role.

-- messages ------------------------------------------------------------------
-- Read: participants see only delivered messages in their own conversations;
-- admin sees everything, blocked attempts included.
create policy "messages participant read" on public.messages
  for select using (
    public.is_admin()
    or (
      blocked_attempt = false
      and exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id
          and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
      )
    )
  );
-- No INSERT / UPDATE / DELETE policy: every message is written by the chat
-- server actions with the service role, after lib/chat-filter.ts has run.
