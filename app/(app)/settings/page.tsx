import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · IP Messenger" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  const settings = await getUserSettings(supabase, data.claims.sub);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-neutral-500">Saved to your account, so they follow you to every device.</p>
      </div>
      <SettingsForm initial={settings} />
    </main>
  );
}
