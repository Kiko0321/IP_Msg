"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET } from "@/lib/validation/avatar";
import { DELETE_CONFIRMATION } from "@/lib/validation/account";
import { ATTACHMENT_BUCKET } from "@/lib/validation/attachment";

export type DeleteAccountState = { error?: string };

const REMOVE_BATCH = 100;

// MSG-44: deletes the signed-in user's account after they re-enter their password and type DELETE.
// Files go first (Storage can't be cleaned from SQL), then delete_my_account() removes the user,
// which cascades to their profile, memberships, messages, settings, blocks and reports.
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  if (String(formData.get("confirm") ?? "").trim() !== DELETE_CONFIRMATION) {
    return { error: `Type ${DELETE_CONFIRMATION} to confirm.` };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter your password." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  const me = data.claims.sub;
  const email = data.claims.email;
  if (!email) return { error: "Your account has no email address, so it can't be confirmed here." };

  // Re-check the password, so an unattended signed-in device can't delete the account.
  const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password });
  if (passwordError) return { error: "That password isn't right." };

  // Files: the user's avatar folder, and every file they attached to a message.
  const { data: avatars } = await supabase.storage.from(AVATAR_BUCKET).list(me);
  const avatarPaths = (avatars ?? []).map((file) => `${me}/${file.name}`);
  if (avatarPaths.length) await supabase.storage.from(AVATAR_BUCKET).remove(avatarPaths);

  const { data: attached } = await supabase
    .from("messages")
    .select("attachment_path")
    .eq("sender_id", me)
    .not("attachment_path", "is", null);
  const attachmentPaths = ((attached ?? []) as { attachment_path: string }[]).map((row) => row.attachment_path);
  for (let i = 0; i < attachmentPaths.length; i += REMOVE_BATCH) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove(attachmentPaths.slice(i, i + REMOVE_BATCH));
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Couldn't delete your account. Try again." };

  // The user no longer exists; clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/sign-in?notice=account-deleted");
}
