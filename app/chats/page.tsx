import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/server";
import { LastActivity } from "./last-activity";

export const metadata: Metadata = { title: "Chats · IP Messenger" };

type Member = { user_id: string; profiles: { display_name: string; avatar_url: string | null } | null };
type Conversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  conversation_members: Member[];
  messages: { content: string; created_at: string; sender_id: string }[];
};

export default async function ChatsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");
  const me = auth.claims.sub;

  // RLS returns only conversations the user belongs to. Each comes with its members and newest message.
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, kind, title, created_at, last_message_at, conversation_members(user_id, profiles(display_name, avatar_url)), messages(content, created_at, sender_id)",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  const conversations = (data ?? []) as unknown as Conversation[];

  // MSG-19: unread messages per conversation (others' messages after this user's last_read_at).
  const { data: unreadRows } = await supabase.rpc("unread_counts");
  const unread = new Map<string, number>(
    ((unreadRows ?? []) as { conversation_id: string; unread: number }[]).map((r) => [r.conversation_id, Number(r.unread)]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-sm text-neutral-500 underline">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">Chats</h1>
        </div>
        <Link
          href="/contacts"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          New chat
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}

      {conversations.length === 0 ? (
        <p className="text-neutral-500">
          No conversations yet.{" "}
          <Link href="/contacts" className="underline">
            Find someone to message
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {conversations.map((conversation) => {
            const others = conversation.conversation_members.filter((m) => m.user_id !== me);
            const other = others[0]?.profiles;
            const name =
              conversation.kind === "group"
                ? (conversation.title ?? others.map((m) => m.profiles?.display_name).filter(Boolean).join(", "))
                : (other?.display_name ?? "Unknown user");
            const last = conversation.messages[0];
            const unreadCount = unread.get(conversation.id) ?? 0;

            return (
              <li key={conversation.id}>
                <Link
                  href={`/chat/${conversation.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <Avatar name={name || "?"} url={conversation.kind === "direct" ? other?.avatar_url : null} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate ${unreadCount ? "font-bold" : "font-medium"}`}>{name || "Group"}</p>
                      <LastActivity at={last?.created_at ?? conversation.last_message_at} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${unreadCount ? "text-foreground" : "text-neutral-500"}`}>
                        {last ? `${last.sender_id === me ? "You: " : ""}${last.content}` : "No messages yet"}
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
