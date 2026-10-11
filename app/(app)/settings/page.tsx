import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { unblockFromForm } from "@/app/(app)/safety/actions";
import { Avatar } from "@/components/avatar";
import { getUserSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · IP Messenger" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  const [settings, { data: blockRows }] = await Promise.all([
    getUserSettings(supabase, data.claims.sub),
    // MSG-43: people this user has blocked (RLS: only their own blocks).
    supabase
      .from("blocks")
      .select("blocked_id, profiles!blocks_blocked_id_fkey(display_name, avatar_url)")
      .eq("blocker_id", data.claims.sub)
      .order("created_at", { ascending: false }),
  ]);
  const blocked = (blockRows ?? []) as unknown as {
    blocked_id: string;
    profiles: { display_name: string; avatar_url: string | null } | null;
  }[];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-neutral-500">Saved to your account, so they follow you to every device.</p>
      </div>
      <SettingsForm initial={settings} />

      <section className="flex flex-col gap-2" aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="font-medium">
          Blocked people
        </h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-neutral-500">
            You haven&apos;t blocked anyone. To block someone, open your chat with them and use ⋯ at the top.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {blocked.map((row) => (
              <li key={row.blocked_id} className="flex items-center gap-3 py-2">
                <Avatar name={row.profiles?.display_name ?? "?"} url={row.profiles?.avatar_url} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{row.profiles?.display_name ?? "Former user"}</span>
                <form action={unblockFromForm}>
                  <input type="hidden" name="userId" value={row.blocked_id} />
                  <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700">
                    Unblock
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
