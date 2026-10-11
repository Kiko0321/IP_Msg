"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/(app)/chat/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatMember, ChatMessage, DisplayMessage } from "@/lib/chat/types";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { ReadMarker } from "./read-marker";

// Older messages are fetched this many at a time (MSG-38).
const OLDER_PAGE_SIZE = 50;

// Owns the conversation's client-side message state. Messages from the server (props) are merged
// with this user's local ones (sending, failed, or saved but not yet in the props).
export function ChatView({
  conversationId,
  initialMessages,
  members,
  currentUserId,
  isGroup,
  hasOlder: initialHasOlder,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  members: Record<string, ChatMember>;
  currentUserId: string;
  isGroup: boolean;
  /** The server sent a full page of history, so there may be older messages (MSG-38). */
  hasOlder: boolean;
}) {
  const [local, setLocal] = useState<DisplayMessage[]>([]);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [, startTransition] = useTransition();

  // Newest message time currently shown; the catch-up query below starts from here.
  const latestAtRef = useRef<string | undefined>(undefined);

  // Live updates (MSG-18): new rows in this conversation arrive over Supabase Realtime.
  // RLS is applied per subscriber, so only members receive them.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    const addRow = (row: ChatMessage) =>
      setLocal((list) => {
        if (list.some((m) => m.id === row.id)) return list;
        // Our own message can arrive here before sendMessage returns; the pending
        // placeholder is swapped for it then, so don't add a duplicate now.
        const pendingOwn = row.sender_id === currentUserId && list.some((m) => m.status === "sending" && m.content === row.content);
        return pendingOwn ? list : [...list, row];
      });

    // Messages sent while the channel was connecting (or reconnecting) never arrive as events,
    // so fetch anything newer than what is on screen each time the subscription becomes active.
    async function catchUp() {
      let query = supabase
        .from("messages")
        .select("id, sender_id, content, created_at, edited_at")
        .eq("conversation_id", conversationId)
        .order("created_at")
        .limit(100);
      if (latestAtRef.current) query = query.gt("created_at", latestAtRef.current);
      const { data } = await query;
      if (!cancelled) (data as ChatMessage[] | null)?.forEach(addRow);
    }

    async function subscribe() {
      // Make sure Realtime uses the signed-in session, not the anonymous key: with RLS, an
      // anonymous subscriber receives no message events at all.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => addRow(payload.new as ChatMessage),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void catchUp();
        });
    }

    void subscribe();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const serverIds = new Set(initialMessages.map((m) => m.id));
  const messages: DisplayMessage[] = [
    ...older.filter((m) => !serverIds.has(m.id)),
    ...initialMessages,
    ...local.filter((m) => !serverIds.has(m.id)),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // MSG-38: fetch the page of messages before the oldest one shown. RLS limits it to members.
  async function loadOlder() {
    const oldest = messages.find((m) => !m.status)?.created_at;
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data, error } = await createClient()
      .from("messages")
      .select("id, sender_id, content, created_at, edited_at")
      .eq("conversation_id", conversationId)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(OLDER_PAGE_SIZE);
    setLoadingOlder(false);
    if (error) return;
    const page = (data ?? []) as ChatMessage[];
    setOlder((list) => [...page, ...list]);
    setHasOlder(page.length === OLDER_PAGE_SIZE);
  }

  useEffect(() => {
    latestAtRef.current = messages.filter((m) => !m.status).at(-1)?.created_at;
  });

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
      <MessageList
        messages={messages}
        members={members}
        currentUserId={currentUserId}
        showSenderNames={isGroup}
        hasOlder={hasOlder}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
      />
      <MessageInput onSend={handleSend} />
      <ReadMarker conversationId={conversationId} latestMessageAt={messages.at(-1)?.created_at} />
    </>
  );
}
