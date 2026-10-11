"use client";

import { useEffect, useRef } from "react";
import { markConversationRead } from "@/app/(app)/chat/[id]/read-actions";

// Marks the open conversation read: on open, whenever a newer message is shown, and when the
// tab becomes visible again. Renders nothing.
// MSG-42: onMarked lets the chat tell the other members (for "Seen" receipts).
export function ReadMarker({
  conversationId,
  latestMessageAt,
  onMarked,
}: {
  conversationId: string;
  latestMessageAt?: string;
  onMarked?: () => void;
}) {
  const marked = useRef(onMarked);
  useEffect(() => {
    marked.current = onMarked;
  });

  useEffect(() => {
    if (document.visibilityState === "visible") void markConversationRead(conversationId).then(() => marked.current?.());
  }, [conversationId, latestMessageAt]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void markConversationRead(conversationId).then(() => marked.current?.());
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId]);

  return null;
}
