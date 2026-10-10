import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Landing page for visitors; signed-in users go straight to their chats (MSG-20).
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/chats");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">IP Messenger</h1>
      <p className="max-w-sm text-neutral-500">Fast, private messaging with the people you work with.</p>
      <div className="flex gap-3">
        <Link href="/sign-in" className="rounded-md bg-neutral-900 px-3 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">
          Sign in
        </Link>
        <Link href="/sign-up" className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700">
          Sign up
        </Link>
      </div>
    </main>
  );
}
