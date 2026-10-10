"use client";

import { useEffect, useState, useTransition } from "react";
import { sendMessage } from "@/app/chat/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatMember, ChatMessage, DisplayMessage } from "@/lib/chat/types";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { ReadMarker } from "./read-marker";

// Owns the conversation's client-side message state. Messages from the server (props) are merged
// with this user's local ones (sending, failed, or saved but not yet in the props).
export function ChatView({
  conversationId,
  initialMessages,
  members,
  currentUserId,
  isGroup,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  members: Record<string, ChatMember>;
  currentUserId: string;
  isGroup: boolean;
}) {
  const [local, setLocal] = useState<DisplayMessage[]>([]);
  const [, startTransition] = useTransition();

  // Live updates (MSG-18): new rows in this conversation arrive over Supabase Realtime.
  // RLS is applied per subscriber, so only members receive them.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setLocal((list) => {
            if (list.some((m) => m.id === row.id)) return list;
            // Our own message can arrive here before sendMessage returns; the pending
            // placeholder is swapped for it then, so don't add a duplicate now.
            const pendingOwn = row.sender_id === currentUserId && list.some((m) => m.status === "sending" && m.content === row.content);
            return pendingOwn ? list : [...list, row];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const serverIds = new Set(initialMessages.map((m) => m.id));
  const messages: DisplayMessage[] = [...initialMessages, ...local.filter((m) => !serverIds.has(m.id))].sort(
    (a, b) => a.created_at.localeCompare(b.created_at),
  );

  function handleSend(content: string) {
    const tempId = `local-${crypto.randomUUID()}`;
    const pending: DisplayMessage = {
      id: tempId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
      status: "sending",
    };
    setLocal((list) => [...list, pending]);

    startTransition(async () => {
      const result = await sendMessage(conversationId, content);
      setLocal((list) =>
        list.map((m) => {
          if (m.id !== tempId) return m;
          // Swap the placeholder for the saved row, or mark it failed.
          return result.message ? result.message : { ...m, status: "failed" };
        }),
      );
    });
  }

  return (
    <>
      <MessageList messages={messages} members={members} currentUserId={currentUserId} showSenderNames={isGroup} />
      <MessageInput onSend={handleSend} />
      <ReadMarker conversationId={conversationId} latestMessageAt={messages.at(-1)?.created_at} />
    </>
  );
}
