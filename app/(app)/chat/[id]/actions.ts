"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_COLUMNS, type ChatMessage } from "@/lib/chat/types";
import { attachmentSchema, type AttachmentInput } from "@/lib/validation/attachment";
import { captionSchema, messageSchema } from "@/lib/validation/message";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `attachment` (MSG-39) is a file the browser has already uploaded to this conversation's folder.
export async function sendMessage(
  conversationId: string,
  content: string,
  attachment?: AttachmentInput,
): Promise<{ message?: ChatMessage; error?: string }> {
  if (!UUID_PATTERN.test(conversationId)) return { error: "Unknown conversation." };

  const parsed = (attachment ? captionSchema : messageSchema).safeParse(content);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const file = attachment ? attachmentSchema(conversationId).safeParse(attachment) : undefined;
  if (file && !file.success) return { error: "Invalid attachment." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "You are signed out. Sign in and try again." };

  // RLS rejects the insert unless the sender is a member and sender_id is the caller.
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: auth.claims.sub,
      content: parsed.data,
      ...(file?.data && {
        attachment_path: file.data.path,
        attachment_name: file.data.name,
        attachment_type: file.data.type,
        attachment_size: file.data.size,
      }),
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) return { error: "Message not sent. You may no longer be in this conversation." };

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chats");
  return { message: data as ChatMessage };
}
