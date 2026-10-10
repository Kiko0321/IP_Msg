"use client";

import { useEffect } from "react";
import { markConversationRead } from "@/app/chat/[id]/read-actions";

// Marks the open conversation read: on open, whenever a newer message is shown, and when the
// tab becomes visible again. Renders nothing.
export function ReadMarker({ conversationId, latestMessageAt }: { conversationId: string; latestMessageAt?: string }) {
  useEffect(() => {
    if (document.visibilityState === "visible") void markConversationRead(conversationId);
  }, [conversationId, latestMessageAt]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void markConversationRead(conversationId);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId]);

  return null;
}
