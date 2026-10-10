import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Connectivity check for MSG-05: GET /api/health/supabase
// Reads no user data; only confirms the URL and publishable key are accepted and the cookie session wiring works.
export async function GET() {
  try {
    const { url, publishableKey } = getSupabaseEnv();

    const auth = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
    });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    const ok = auth.ok && !error;
    return NextResponse.json(
      {
        ok,
        authStatus: auth.status,
        signedIn: Boolean(data?.claims),
        error: error?.message ?? null,
      },
      { status: ok ? 200 : 503 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
