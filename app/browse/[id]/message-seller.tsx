"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/ui/chat-thread";
import { openConversation } from "@/app/chat/actions";

/**
 * Buyer-facing "Message seller" entry point on the vehicle detail page. No
 * reservation needed — any approved listing can be messaged. Opens (or creates)
 * the one conversation for this buyer + vehicle and drops in the shared thread.
 */
export function MessageSeller({
  vehicleId,
  buyerId,
  existingConversationId,
}: {
  vehicleId: string;
  buyerId: string;
  existingConversationId: string | null;
}) {
  const [conversationId, setConversationId] = useState<string | null>(
    existingConversationId,
  );
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setOpening(true);
    setError(null);
    const res = await openConversation(vehicleId);
    setOpening(false);
    if (res.ok) setConversationId(res.conversationId);
    else setError(res.error);
  }

  return (
    <section className="mt-10">
      <h2 className="font-mono text-xs uppercase tracking-wider text-ink-400">
        Message the seller
      </h2>

      {conversationId ? (
        <div className="mt-3">
          <ChatThread
            conversationId={conversationId}
            selfId={buyerId}
            counterpartyLabel="Seller"
            emptyHint="No messages yet. Ask the seller anything about this vehicle — MOVA connects you directly once the deal is confirmed."
          />
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-paper-200 bg-paper-100 p-6">
          <p className="text-sm text-slate-500">
            Have a question about this vehicle? Message the seller directly.
            You don&rsquo;t need to reserve it first.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={open}
            disabled={opening}
          >
            {opening ? "Opening…" : "Message seller"}
          </Button>
          {error ? (
            <p className="mt-3 text-sm text-copper-700">{error}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
