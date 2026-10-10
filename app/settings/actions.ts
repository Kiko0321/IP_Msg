"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { settingsFromFormData, settingsSchema, type Settings } from "@/lib/validation/settings";

export type SettingsState = {
  values?: Settings;
  fieldErrors?: Partial<Record<keyof Settings, string[]>>;
  error?: string;
  message?: string;
};

export async function updateSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = settingsSchema.safeParse(settingsFromFormData(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Creates the row on first save; RLS limits both insert and update to the caller's own row.
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: data.claims.sub,
      theme: parsed.data.theme,
      notify_new_messages: parsed.data.notifyNewMessages,
      notify_sound: parsed.data.notifySound,
    },
    { onConflict: "user_id" },
  );
  if (error) return { values: parsed.data, error: error.message };

  revalidatePath("/", "layout");
  return { values: parsed.data, message: "Settings saved." };
}
