import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Signed-in users have no reason to see the auth pages.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/");

  return <main className="flex min-h-screen items-center justify-center p-8">{children}</main>;
}
