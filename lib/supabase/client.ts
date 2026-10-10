import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Supabase client for Client Components. The session lives in cookies shared with the server.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
