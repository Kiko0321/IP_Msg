import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { OnlineDot } from "@/components/presence/online-status";
import { createClient } from "@/lib/supabase/server";
import { startConversation } from "./actions";

export const metadata: Metadata = { title: "Contacts · IP Messenger" };

const PAGE_SIZE = 50;

// Escape LIKE wildcards so a search for "50%" matches literally.
function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

type Contact = {
  id: string;
  display_name: string;
  status_message: string | null;
  avatar_url: string | null;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { q = "", error } = await searchParams;
  const query = q.trim().slice(0, 50);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");

  let request = supabase
    .from("profiles")
    .select("id, display_name, status_message, avatar_url")
    .neq("id", auth.claims.sub)
    .order("display_name")
    .limit(PAGE_SIZE);
  if (query) request = request.ilike("display_name", likePattern(query));

  const { data, error: loadError } = await request;
  const contacts = (data ?? []) as Contact[];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-neutral-500 underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Contacts</h1>
      </div>

      <form role="search" className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name"
          aria-label="Search contacts by name"
          maxLength={50}
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <button type="submit" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">
          Search
        </button>
      </form>

      {(error || loadError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error ?? loadError?.message}
        </p>
      )}

      {contacts.length === 0 ? (
        <p className="text-neutral-500">{query ? `No one matches “${query}”.` : "No other users yet."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center gap-3 py-3">
              <span className="relative shrink-0">
                <Avatar name={contact.display_name} url={contact.avatar_url} />
                <OnlineDot userId={contact.id} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{contact.display_name}</p>
                {contact.status_message && (
                  <p className="truncate text-sm text-neutral-500">{contact.status_message}</p>
                )}
              </div>
              <form action={startConversation}>
                <input type="hidden" name="userId" value={contact.id} />
                <button
                  type="submit"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                >
                  Message
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {contacts.length === PAGE_SIZE && (
        <p className="text-sm text-neutral-500">Showing the first {PAGE_SIZE}. Refine your search to find more.</p>
      )}
    </main>
  );
}
