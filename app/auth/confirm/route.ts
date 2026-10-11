import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the sign-up confirmation and password reset (MSG-31) emails.
// Handles both link styles: the default "?code=" (PKCE) and a custom template's "?token_hash=&type=".
// "?next=" picks the page to open once signed in; only same-site paths are accepted.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "";
  const isReset = type === "recovery" || next === "/reset-password";

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  let target: string;
  if (!ok) target = isReset ? "/forgot-password?notice=link-expired" : "/sign-in?notice=confirm-failed";
  else if (isReset) target = "/reset-password";
  else target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return NextResponse.redirect(new URL(target, origin));
}
