import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type Settings, type Theme } from "@/lib/validation/settings";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Reads the user's settings, falling back to defaults when they have never saved any.
export async function getUserSettings(supabase: ServerClient, userId: string): Promise<Settings> {
  const { data } = await supabase
    .from("user_settings")
    .select("theme, notify_new_messages, notify_sound")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;
  return {
    theme: data.theme as Theme,
    notifyNewMessages: data.notify_new_messages,
    notifySound: data.notify_sound,
  };
}
