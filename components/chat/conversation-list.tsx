import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { OnlineDot } from "@/components/presence/online-status";
import type { createClient } from "@/lib/supabase/server";
import { ConversationLink } from "./conversation-link";
import { LastActivity } from "./last-activity";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type Member = { user_id: string; profiles: { display_name: string; avatar_url: string | null } | null };
type Conversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  conversation_members: Member[];
  messages: { content: string; created_at: string; sender_id: string; attachment_name: string | null }[];
};

// The user's conversations, newest activity first, with last-message preview (MSG-15) and
// unread counts (MSG-19). Used by the sidebar (desktop) and the /chats page (mobile).
export async function ConversationList({ supabase, me }: { supabase: ServerClient; me: string }) {
  // RLS returns only conversations the user belongs to. Each comes with its members and newest message.
  const [{ data, error }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, kind, title, created_at, last_message_at, conversation_members(user_id, profiles(display_name, avatar_url)), messages(content, created_at, sender_id, attachment_name)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" }),
    supabase.rpc("unread_counts"),
  ]);

  const conversations = (data ?? []) as unknown as Conversation[];
  const unread = new Map<string, number>(
    ((unreadRows ?? []) as { conversation_id: string; unread: number }[]).map((r) => [r.conversation_id, Number(r.unread)]),
  );

  if (error) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600 dark:text-red-400">
        {error.message}
      </p>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="p-4 text-sm text-neutral-500">
        No conversations yet.{" "}
        <Link href="/contacts" className="underline">
          Find someone to message
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {conversations.map((conversation) => {
        const others = conversation.conversation_members.filter((m) => m.user_id !== me);
        const otherMember = others[0];
        const other = otherMember?.profiles;
        const isDirect = conversation.kind === "direct";
        const name = isDirect
          ? (other?.display_name ?? "Unknown user")
          : conversation.title || others.map((m) => m.profiles?.display_name).filter(Boolean).join(", ") || "Group";
        const last = conversation.messages[0];
        const unreadCount = unread.get(conversation.id) ?? 0;

        return (
          <li key={conversation.id}>
            <ConversationLink href={`/chat/${conversation.id}`}>
              <span className="relative shrink-0">
                <Avatar name={name} url={isDirect ? other?.avatar_url : null} />
                {isDirect && otherMember && <OnlineDot userId={otherMember.user_id} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate ${unreadCount ? "font-bold" : "font-medium"}`}>{name}</p>
                  <LastActivity at={last?.created_at ?? conversation.last_message_at} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${unreadCount ? "text-foreground" : "text-neutral-500"}`}>
                    {last
                      ? `${last.sender_id === me ? "You: " : ""}${last.content || (last.attachment_name ? `📎 ${last.attachment_name}` : "")}`
                      : "No messages yet"}
                  </p>
                  {unreadCount > 0 && (
                    <span
                      aria-label={`${unreadCount} unread`}
                      className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </ConversationLink>
          </li>
        );
      })}
    </ul>
  );
}
