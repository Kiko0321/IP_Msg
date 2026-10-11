import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatView } from "@/components/chat/chat-view";
import { OnlineStatus } from "@/components/presence/online-status";
import { MESSAGE_COLUMNS, type ChatMember, type ChatMessage } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat · IP Messenger" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_LIMIT = 100;

type ConversationRow = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  conversation_members: {
    user_id: string;
    last_read_at: string | null;
    profiles: { display_name: string; avatar_url: string | null; last_seen_at: string | null } | null;
  }[];
};

const NOTICES: Record<string, string> = {
  "members-failed": "The group was created, but some people couldn't be added.",
};

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; m?: string }>;
}) {
  const { id } = await params;
  const { notice, m: highlightId } = await searchParams;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");
  const me = auth.claims.sub;

  // RLS: non-members get no row, so they see a 404 rather than someone else's chat.
  const { data: conversationData } = await supabase
    .from("conversations")
    .select("id, kind, title, conversation_members(user_id, last_read_at, profiles(display_name, avatar_url, last_seen_at))")
    .eq("id", id)
    .maybeSingle();
  const conversation = conversationData as unknown as ConversationRow | null;
  if (!conversation || !conversation.conversation_members.some((m) => m.user_id === me)) notFound();

  // Newest HISTORY_LIMIT messages, shown oldest first.
  const { data: messageData } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const messages = ((messageData ?? []) as ChatMessage[]).reverse();

  const members: Record<string, ChatMember> = {};
  for (const m of conversation.conversation_members) {
    members[m.user_id] = {
      user_id: m.user_id,
      display_name: m.profiles?.display_name ?? "Unknown user",
      avatar_url: m.profiles?.avatar_url ?? null,
    };
  }
  const others = Object.values(members).filter((m) => m.user_id !== me);

  const isGroup = conversation.kind === "group";
  const title = isGroup
    ? (conversation.title ?? (others.map((m) => m.display_name).join(", ") || "Group"))
    : (others[0]?.display_name ?? "Unknown user");
  const otherMember = conversation.conversation_members.find((m) => m.user_id !== me);
  const subtitle = isGroup ? (
    `${others.length + 1} members`
  ) : otherMember ? (
    <OnlineStatus userId={otherMember.user_id} lastSeenAt={otherMember.profiles?.last_seen_at ?? null} />
  ) : undefined;

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <ChatHeader title={title} subtitle={subtitle} avatarUrl={isGroup ? null : others[0]?.avatar_url} />
      {notice && NOTICES[notice] && (
        <p role="alert" className="mx-4 mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {NOTICES[notice]}
        </p>
      )}
      <ChatView
        conversationId={conversation.id}
        initialMessages={messages}
        members={members}
        currentUserId={me}
        isGroup={isGroup}
        hasOlder={messages.length === HISTORY_LIMIT}
        highlightId={highlightId && UUID_PATTERN.test(highlightId) ? highlightId : undefined}
        readAt={Object.fromEntries(conversation.conversation_members.map((m) => [m.user_id, m.last_read_at]))}
      />
    </main>
  );
}
