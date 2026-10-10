import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageList } from "@/components/chat/message-list";
import type { ChatMember, ChatMessage } from "@/lib/chat/types";
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
    profiles: { display_name: string; avatar_url: string | null } | null;
  }[];
};

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");
  const me = auth.claims.sub;

  // RLS: non-members get no row, so they see a 404 rather than someone else's chat.
  const { data: conversationData } = await supabase
    .from("conversations")
    .select("id, kind, title, conversation_members(user_id, profiles(display_name, avatar_url))")
    .eq("id", id)
    .maybeSingle();
  const conversation = conversationData as unknown as ConversationRow | null;
  if (!conversation || !conversation.conversation_members.some((m) => m.user_id === me)) notFound();

  // Newest HISTORY_LIMIT messages, shown oldest first.
  const { data: messageData } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at, edited_at")
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
  const subtitle = isGroup ? `${others.length + 1} members` : undefined;

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <ChatHeader title={title} subtitle={subtitle} avatarUrl={isGroup ? null : others[0]?.avatar_url} />
      <MessageList messages={messages} members={members} currentUserId={me} showSenderNames={isGroup} />
    </main>
  );
}
