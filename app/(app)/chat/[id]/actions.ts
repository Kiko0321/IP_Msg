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

// MSG-40: editing and deleting your own messages. RLS (MSG-12) already limits both to the sender
// and edits to the content and edited_at columns; these checks give clear errors first.

type OwnMessage = { id: string; sender_id: string; attachment_path: string | null };

async function ownMessage(conversationId: string, messageId: string) {
  if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(messageId)) return { error: "Unknown message." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "You are signed out. Sign in and try again." };

  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, attachment_path")
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  const message = data as OwnMessage | null;
  if (!message) return { error: "That message no longer exists." };
  if (message.sender_id !== auth.claims.sub) return { error: "You can only change your own messages." };
  return { supabase, message };
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  content: string,
): Promise<{ message?: ChatMessage; error?: string }> {
  const found = await ownMessage(conversationId, messageId);
  if ("error" in found) return { error: found.error };
  const { supabase, message } = found;

  // A message with a file may have its text removed; one without must keep some text.
  const parsed = (message.attachment_path ? captionSchema : messageSchema).safeParse(content);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const { data, error } = await supabase
    .from("messages")
    .update({ content: parsed.data, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) return { error: "Couldn't save the change. Try again." };

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chats");
  return { message: data as ChatMessage };
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<{ error?: string }> {
  const found = await ownMessage(conversationId, messageId);
  if ("error" in found) return { error: found.error };
  const { supabase, message } = found;

  const { error } = await supabase.from("messages").delete().eq("id", messageId);
  if (error) return { error: "Couldn't delete the message. Try again." };

  // Its file goes too (MSG-39); the bucket lets only the uploader delete it.
  if (message.attachment_path) await supabase.storage.from("attachments").remove([message.attachment_path]);

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chats");
  return {};
}
