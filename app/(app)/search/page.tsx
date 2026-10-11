import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { messageSearchFilter, SEARCH_MAX, SEARCH_MIN, searchTerm, snippet } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search · IP Messenger" };

const RESULT_LIMIT = 50;

type Result = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  attachment_name: string | null;
  profiles: { display_name: string } | null;
  conversations: {
    kind: "direct" | "group";
    title: string | null;
    conversation_members: { user_id: string; profiles: { display_name: string } | null }[];
  } | null;
};

// MSG-41: find messages in any of the user's chats. RLS limits results to their conversations.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = searchTerm(q);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");
  const me = auth.claims.sub;

  let results: Result[] = [];
  let error: string | undefined;
  if (term) {
    const response = await supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, content, created_at, attachment_name, profiles(display_name), conversations(kind, title, conversation_members(user_id, profiles(display_name)))",
      )
      .or(messageSearchFilter(term))
      .order("created_at", { ascending: false })
      .limit(RESULT_LIMIT);
    results = (response.data ?? []) as unknown as Result[];
    error = response.error?.message;
  }

  function chatName(result: Result) {
    const chat = result.conversations;
    const others = chat?.conversation_members.filter((m) => m.user_id !== me) ?? [];
    if (chat?.kind === "group") return chat.title || others.map((m) => m.profiles?.display_name).join(", ") || "Group";
    return others[0]?.profiles?.display_name ?? "Unknown user";
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Search messages</h1>

      <form role="search" className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Words or a file name"
          aria-label="Search messages"
          minLength={SEARCH_MIN}
          maxLength={SEARCH_MAX}
          autoFocus
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <button type="submit" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">
          Search
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!term ? (
        <p className="text-sm text-neutral-500">
          {q?.trim() ? `Type at least ${SEARCH_MIN} characters.` : "Search all your chats, including file names."}
        </p>
      ) : results.length === 0 ? (
        <p className="text-neutral-500">No messages match “{term}”.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800" aria-label="Results">
            {results.map((result) => {
              const text = result.content || (result.attachment_name ? `📎 ${result.attachment_name}` : "");
              const part = snippet(text, term);
              const sender = result.sender_id === me ? "You" : (result.profiles?.display_name ?? "Former member");
              return (
                <li key={result.id}>
                  <Link
                    href={`/chat/${result.conversation_id}?m=${result.id}`}
                    className="flex flex-col gap-0.5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{chatName(result)}</span>
                      <time dateTime={result.created_at} className="shrink-0 text-xs text-neutral-500" suppressHydrationWarning>
                        {new Date(result.created_at).toLocaleDateString()}
                      </time>
                    </span>
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">
                      <span className="text-neutral-500">{sender}: </span>
                      {part.before}
                      {part.match && <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700 dark:text-white">{part.match}</mark>}
                      {part.after}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {results.length === RESULT_LIMIT && (
            <p className="text-sm text-neutral-500">Showing the newest {RESULT_LIMIT}. Add words to narrow it down.</p>
          )}
        </>
      )}
    </main>
  );
}
