import type { Metadata } from "next";
import Link from "next/link";
import { ConversationList } from "@/components/chat/conversation-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chats · IP Messenger" };

// Mobile: the conversation list. Desktop: the list is already in the sidebar, so this shows a
// prompt to pick a conversation. (The (app) layout ensures the user is signed in.)
export default async function ChatsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub ?? "";

  return (
    <>
      <main className="flex flex-col md:hidden">
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <h1 className="text-2xl font-bold">Chats</h1>
          <Link
            href="/contacts"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            New chat
          </Link>
        </div>
        <ConversationList supabase={supabase} me={me} />
      </main>

      <main className="hidden h-full flex-col items-center justify-center gap-2 p-8 text-center md:flex">
        <h1 className="text-xl font-semibold">Select a conversation</h1>
        <p className="text-sm text-neutral-500">
          Choose a chat on the left, or{" "}
          <Link href="/contacts" className="underline">
            start a new one
          </Link>
          .
        </p>
      </main>
    </>
  );
}
