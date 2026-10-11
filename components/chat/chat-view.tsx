"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteMessage, editMessage, sendMessage } from "@/app/(app)/chat/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_BUCKET, attachmentPath } from "@/lib/validation/attachment";
import { MESSAGE_COLUMNS, type ChatMember, type ChatMessage, type DisplayMessage } from "@/lib/chat/types";
import { TYPING_RESEND_MS, TYPING_TTL_MS, receiptLabel, seenBy, typingLabel } from "@/lib/receipts";
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
  highlightId,
  readAt,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  members: Record<string, ChatMember>;
  currentUserId: string;
  isGroup: boolean;
  /** The server sent a full page of history, so there may be older messages (MSG-38). */
  hasOlder: boolean;
  /** MSG-41: a message opened from search, to scroll to and highlight. */
  highlightId?: string;
  /** MSG-42: each member's last_read_at, for "Seen" receipts. */
  readAt: Record<string, string | null>;
}) {
  const [local, setLocal] = useState<DisplayMessage[]>([]);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // MSG-40: edits (a newer copy of the row) and deletions (null), from this user or live.
  const [changes, setChanges] = useState<ReadonlyMap<string, ChatMessage | null>>(() => new Map());
  const change = (id: string, row: ChatMessage | null) => setChanges((map) => new Map(map).set(id, row));
  const [, startTransition] = useTransition();

  // MSG-42: who is typing (user id → when that stops counting), and the channel to ping others on.
  const router = useRouter();
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);
  const channelRef = useRef<{ send: (message: { type: "broadcast"; event: string; payload: object }) => unknown } | null>(null);
  const memberIds = useRef(new Set(Object.keys(members)));
  useEffect(() => {
    memberIds.current = new Set(Object.keys(members));
  });

  // Newest message time currently shown; the catch-up query below starts from here.
  const latestAtRef = useRef<string | undefined>(undefined);

  // Live updates (MSG-18): new rows in this conversation arrive over Supabase Realtime.
  // RLS is applied per subscriber, so only members receive them.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    let refreshTimer: number | undefined;

    const addRow = (row: ChatMessage) =>
      setLocal((list) => {
        if (list.some((m) => m.id === row.id)) return list;
        // Our own message can arrive here before sendMessage returns; the pending
        // placeholder is swapped for it then, so don't add a duplicate now.
        const pendingOwn = row.sender_id === currentUserId && list.some(
            (m) =>
              m.status === "sending" &&
              m.content === row.content &&
              (m.attachment_name ?? null) === (row.attachment_name ?? null),
          );
        return pendingOwn ? list : [...list, row];
      });

    // Messages sent while the channel was connecting (or reconnecting) never arrive as events,
    // so fetch anything newer than what is on screen each time the subscription becomes active.
    async function catchUp() {
      let query = supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
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
        // MSG-40: edits and deletions. Delete events only carry the id and can't be filtered by
        // conversation, so ids from other chats are simply not found here.
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => change((payload.new as ChatMessage).id, payload.new as ChatMessage),
        )
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) change(id, null);
        })
        // MSG-42: lightweight pings between open chats (Realtime broadcast, never stored).
        // "typing" is shown for a few seconds, and only for members; "read" makes this page
        // re-read last_read_at from the database, so a fake ping can't fake a receipt.
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const userId = (payload as { userId?: string }).userId;
          if (!userId || userId === currentUserId || !memberIds.current.has(userId)) return;
          const t = Date.now();
          setNow(t);
          setTyping((current) => ({ ...current, [userId]: t + TYPING_TTL_MS }));
        })
        .on("broadcast", { event: "read" }, () => {
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => router.refresh(), 300);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void catchUp();
        });
    }

    void subscribe().then(() => {
      if (channel) channelRef.current = channel;
    });
    return () => {
      cancelled = true;
      channelRef.current = null;
      window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, router]);

  const serverIds = new Set(initialMessages.map((m) => m.id));
  const messages: DisplayMessage[] = [
    ...older.filter((m) => !serverIds.has(m.id)),
    ...initialMessages,
    ...local.filter((m) => !serverIds.has(m.id)),
  ]
    .flatMap((m) => {
      if (!changes.has(m.id)) return [m];
      const changed = changes.get(m.id);
      return changed ? [{ ...m, ...changed }] : [];
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // MSG-40: shown at once, undone if the server refuses.
  async function handleEdit(message: DisplayMessage, content: string) {
    change(message.id, { ...message, content, edited_at: new Date().toISOString() });
    const result = await editMessage(conversationId, message.id, content);
    change(message.id, result.message ?? message);
    return result.error;
  }

  async function handleDelete(message: DisplayMessage) {
    change(message.id, null);
    const result = await deleteMessage(conversationId, message.id);
    if (result.error) change(message.id, message);
    return result.error;
  }

  // MSG-38: fetch the page of messages before the oldest one shown. RLS limits it to members.
  async function loadOlder() {
    const oldest = messages.find((m) => !m.status)?.created_at;
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data, error } = await createClient()
      .from("messages")
      .select(MESSAGE_COLUMNS)
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

  function handleSend(content: string, file?: File) {
    const tempId = `local-${crypto.randomUUID()}`;
    const pending: DisplayMessage = {
      id: tempId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
      status: "sending",
      ...(file && { attachment_name: file.name, attachment_type: file.type, attachment_size: file.size, localFile: file }),
    };
    setLocal((list) => [...list, pending]);

    startTransition(async () => {
      let attachment;
      if (file) {
        // MSG-39: the browser uploads straight to Storage (Server Actions cap bodies at 1 MB);
        // the bucket's RLS only accepts it in a conversation the user belongs to.
        const path = attachmentPath(conversationId, file.type);
        const { error } = await createClient()
          .storage.from(ATTACHMENT_BUCKET)
          .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
        attachment = error ? null : { path, name: file.name, type: file.type, size: file.size };
      }

      const result = attachment === null ? {} : await sendMessage(conversationId, content, attachment);
      setLocal((list) =>
        list.map((m) => {
          if (m.id !== tempId) return m;
          // Swap the placeholder for the saved row, or mark it failed.
          return result.message ? result.message : { ...m, status: "failed" };
        }),
      );
    });
  }

  // Expired pings are dropped, and a message from someone ends their "typing". `now` ticks
  // once a second only while someone is typing.
  const typists = Object.entries(typing)
    .filter(([user, until]) => until > now && !local.some((m) => m.sender_id === user && Date.parse(m.created_at) > until - TYPING_TTL_MS))
    .map(([user]) => members[user]?.display_name ?? "Someone");
  const typingText = typingLabel(typists);
  const anyTyping = Object.keys(typing).length > 0;
  useEffect(() => {
    if (!anyTyping) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTyping((current) => {
        const live = Object.entries(current).filter(([, until]) => until > t);
        return live.length === Object.keys(current).length ? current : Object.fromEntries(live);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [anyTyping]);

  const lastTypingPing = useRef(0);
  function handleTyping() {
    if (Date.now() - lastTypingPing.current < TYPING_RESEND_MS) return;
    lastTypingPing.current = Date.now();
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } });
  }

  // "Seen" under my newest saved message.
  const myLatest = [...messages].reverse().find((m) => m.sender_id === currentUserId && !m.status);
  const names = Object.fromEntries(Object.values(members).map((m) => [m.user_id, m.display_name]));
  const receipt = myLatest && {
    messageId: myLatest.id,
    label: receiptLabel(seenBy(myLatest.created_at, readAt, currentUserId), names, isGroup, Object.keys(members).length - 1),
  };

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
        highlightId={highlightId}
        receipt={receipt?.label ? receipt : undefined}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <p className="h-5 px-5 text-xs text-neutral-500" aria-live="polite">
        {typingText}
      </p>
      <MessageInput onSend={handleSend} onTyping={handleTyping} />
      <ReadMarker
        conversationId={conversationId}
        latestMessageAt={messages.at(-1)?.created_at}
        onMarked={() => channelRef.current?.send({ type: "broadcast", event: "read", payload: {} })}
      />
    </>
  );
}
