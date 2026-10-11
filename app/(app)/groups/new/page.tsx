import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupForm, type Person } from "./group-form";

export const metadata: Metadata = { title: "New group · IP Messenger" };

// Enough for a team; the form's filter box narrows it down.
const PEOPLE_LIMIT = 500;

// MSG-37: name a group and pick its members.
export default async function NewGroupPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .neq("id", auth.claims.sub)
    .order("display_name")
    .limit(PEOPLE_LIMIT);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">New group</h1>
        <p className="text-sm text-neutral-500">Everyone you add can read and send messages in the group.</p>
      </div>
      <GroupForm people={(data ?? []) as Person[]} />
    </main>
  );
}
