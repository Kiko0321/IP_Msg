"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

export type ProfileState = {
  values?: ProfileInput;
  fieldErrors?: Partial<Record<keyof ProfileInput, string[]>>;
  error?: string;
  message?: string;
};

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const values = {
    displayName: String(formData.get("displayName") ?? ""),
    statusMessage: String(formData.get("statusMessage") ?? ""),
  };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // RLS also limits this to the caller's own row.
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      status_message: parsed.data.statusMessage || null,
    })
    .eq("id", data.claims.sub)
    .select("id");

  if (error) return { values, error: error.message };
  if (!updated?.length) return { values, error: "Your profile was not found. Try signing out and in again." };

  revalidatePath("/", "layout");
  return { values: parsed.data, message: "Profile saved." };
}
