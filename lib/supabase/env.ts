// Read lazily so builds without a .env.local (e.g. CI) don't fail at import time.
// The literal process.env.NEXT_PUBLIC_* references are required for Next to inline them in the browser bundle.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  // The clients append /auth/v1, /rest/v1, ... themselves, so the URL must be the bare project URL.
  const { origin, pathname } = new URL(url);
  if (pathname !== "/") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be the project URL without a path (e.g. ${origin}), got ${url}.`,
    );
  }

  return { url: origin, publishableKey };
}
