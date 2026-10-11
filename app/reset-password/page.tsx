import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/app/(auth)/password-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New password · IP Messenger" };

// MSG-31: outside the (auth) group, because the reset link has already signed the user in
// and that layout sends signed-in users away.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/forgot-password?notice=link-expired");

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <ResetPasswordForm />
    </main>
  );
}
