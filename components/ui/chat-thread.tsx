"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  sendChatMessage,
  markConversationRead,
} from "@/app/chat/actions";

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

/** Near-real-time via polling — fine for v1, no websockets. */
const POLL_MS = 4000;

const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const dayTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function stamp(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? time.format(d) : dayTime.format(d);
}

export function ChatThread({
  conversationId,
  selfId,
  counterpartyLabel,
  initialMessages = [],
  emptyHint,
}: {
  conversationId: string;
  selfId: string;
  counterpartyLabel: string;
  initialMessages?: ChatMessage[];
  emptyHint?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseRef = useRef(createClient());
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabaseRef.current
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("blocked_attempt", false)
      .order("created_at", { ascending: true });
    if (loadError) return;

    setMessages((prev) => {
      const next = (data ?? []) as ChatMessage[];
      const sameTail =
        prev.length === next.length &&
        prev[prev.length - 1]?.id === next[next.length - 1]?.id;
      return sameTail ? prev : next;
    });
  }, [conversationId]);

  // Initial load + poll loop.
  useEffect(() => {
    void load();
    void markConversationRead(conversationId);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load, conversationId]);

  // Clear the seller/buyer unread marker whenever the other side has spoken.
  useEffect(() => {
    if (messages.some((m) => m.sender_id !== selfId)) {
      void markConversationRead(conversationId);
    }
  }, [messages, selfId, conversationId]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setBlockReason(null);
    const res = await sendChatMessage(conversationId, text);
    setSending(false);

    if (res.ok) {
      setDraft("");
      await load();
    } else if ("blocked" in res) {
      setBlockReason(res.reason);
    } else {
      setError(res.error);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-paper-200 bg-paper-100">
      <div
        ref={listRef}
        className="flex max-h-96 min-h-[8rem] flex-col gap-2 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-ink-400">
            {emptyHint ??
              `No messages yet. Say hello — ${counterpartyLabel} will see it here.`}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === selfId;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                    mine
                      ? "bg-marine-600 text-white"
                      : "bg-paper-200 text-ink-900"
                  }`}
                >
                  {m.content}
                </div>
                <span className="mt-0.5 font-mono text-[11px] text-ink-400">
                  {mine ? "You" : counterpartyLabel} · {stamp(m.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-paper-200 p-3"
      >
        {blockReason ? (
          <p className="mb-2 rounded border border-copper-100 bg-copper-50 p-2 text-sm text-copper-700">
            {blockReason}
          </p>
        ) : null}
        {error ? (
          <p className="mb-2 text-sm text-copper-700">{error}</p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Write a message…"
            className="min-h-[2.75rem] flex-1 resize-y rounded border border-paper-200 bg-paper-100 px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine-400"
          />
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Phone numbers, emails, links and off-platform contact are blocked —
          MOVA connects you directly once the deal is confirmed.
        </p>
      </form>
    </div>
  );
}
