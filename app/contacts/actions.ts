"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Opens the existing direct chat with this user, or creates it.
export async function startConversation(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!UUID_PATTERN.test(userId)) redirect("/contacts");

  const supabase = await createClient();
  const { data: conversationId, error } = await supabase.rpc("start_direct_conversation", {
    other_user: userId,
  });

  if (error || !conversationId) {
    redirect(`/contacts?error=${encodeURIComponent(error?.message ?? "Could not start the conversation.")}`);
  }

  redirect(`/chat/${conversationId}`);
}
