"use client";

import { useState, useTransition } from "react";
import { sendMessage } from "@/app/chat/[id]/actions";
import type { ChatMember, ChatMessage, DisplayMessage } from "@/lib/chat/types";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

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
    </>
  );
}
