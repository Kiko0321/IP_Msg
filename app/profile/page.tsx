import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvatarUpload } from "./avatar-upload";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile · IP Messenger" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, status_message, avatar_url")
    .eq("id", data.claims.sub)
    .maybeSingle();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-full max-w-md flex-col gap-1">
        <Link href="/" className="text-sm text-neutral-500 underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-sm text-neutral-500">{data.claims.email}</p>
        <Link href="/network" className="text-sm text-neutral-500 underline">
          Your connection (IP)
        </Link>
      </div>

      <AvatarUpload
        userId={data.claims.sub}
        name={profile?.display_name ?? data.claims.email ?? "?"}
        url={profile?.avatar_url ?? null}
      />

      <ProfileForm
        initial={{
          displayName: profile?.display_name ?? "",
          statusMessage: profile?.status_message ?? "",
        }}
      />
    </main>
  );
}
