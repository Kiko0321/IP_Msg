"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// MSG-19: marks the conversation read for the signed-in user (no-op for non-members).
export async function markConversationRead(conversationId: string) {
  if (!UUID_PATTERN.test(conversationId)) return;

  const supabase = await createClient();
  // /chats is rendered per request, so its counts are fresh on the next visit without revalidation.
  await supabase.rpc("mark_conversation_read", { target: conversationId });
}
