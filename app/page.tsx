import Link from "next/link";
import { signOut } from "./(auth)/actions";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // The profile is created by the sign-up trigger (MSG-07); metadata covers the moment before it exists.
  const { data: profile } = claims
    ? await supabase.from("profiles").select("display_name").eq("id", claims.sub).maybeSingle()
    : { data: null };
  const displayName =
    profile?.display_name ?? (claims?.user_metadata as { display_name?: string } | undefined)?.display_name;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">IP Messenger</h1>

      {claims ? (
        <>
          <p className="text-neutral-500">
            Signed in as <span className="font-medium text-foreground">{displayName ?? claims.email}</span>
          </p>
          <form action={signOut}>
            <button type="submit" className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700">
              Sign out
            </button>
          </form>
        </>
      ) : (
        <div className="flex gap-3">
          <Link href="/sign-in" className="rounded-md bg-neutral-900 px-3 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700">
            Sign up
          </Link>
        </div>
      )}
    </main>
  );
}
