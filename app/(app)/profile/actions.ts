"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET, isOwnAvatarPath } from "@/lib/validation/avatar";
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

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Deletes every file in the user's avatar folder except `keep`, so old uploads don't pile up.
async function removeOtherAvatars(supabase: ServerClient, userId: string, keep?: string) {
  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const stale = (files ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
  if (stale.length) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
}

// Called after the browser has uploaded the file straight to Storage (server actions cap bodies at 1 MB).
export async function setAvatar(path: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "You are signed out. Sign in and try again." };

  const userId = data.claims.sub;
  if (!isOwnAvatarPath(userId, path)) return { error: "Invalid avatar file." };

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
  if (error) return { error: error.message };

  await removeOtherAvatars(supabase, userId, path);
  revalidatePath("/", "layout");
  return {};
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "You are signed out. Sign in and try again." };

  const userId = data.claims.sub;
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) return { error: error.message };

  await removeOtherAvatars(supabase, userId);
  revalidatePath("/", "layout");
  return {};
}
