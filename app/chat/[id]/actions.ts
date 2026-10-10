"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/chat/types";
import { messageSchema } from "@/lib/validation/message";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<{ message?: ChatMessage; error?: string }> {
  if (!UUID_PATTERN.test(conversationId)) return { error: "Unknown conversation." };

  const parsed = messageSchema.safeParse(content);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "You are signed out. Sign in and try again." };

  // RLS rejects the insert unless the sender is a member and sender_id is the caller.
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: auth.claims.sub, content: parsed.data })
    .select("id, sender_id, content, created_at, edited_at")
    .single();

  if (error) return { error: "Message not sent. You may no longer be in this conversation." };

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chats");
  return { message: data as ChatMessage };
}
