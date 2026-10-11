"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportSchema, type ReportInput } from "@/lib/validation/report";

// MSG-43: blocking and reporting. RLS limits blocks and reports to the caller's own rows; the
// database also refuses direct chats and messages between people who have blocked each other.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCERPT_MAX = 500;

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? { supabase, me: data.claims.sub } : null;
}

export async function blockUser(userId: string): Promise<{ error?: string }> {
  if (!UUID_PATTERN.test(userId)) return { error: "Unknown user." };
  const session = await signedIn();
  if (!session) return { error: "You are signed out. Sign in and try again." };
  if (userId === session.me) return { error: "You can't block yourself." };

  // Blocking twice is fine: the existing block stays.
  const { error } = await session.supabase
    .from("blocks")
    .upsert({ blocker_id: session.me, blocked_id: userId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) return { error: "Couldn't block this person. Try again." };

  revalidatePath("/", "layout");
  return {};
}

export async function unblockUser(userId: string): Promise<{ error?: string }> {
  if (!UUID_PATTERN.test(userId)) return { error: "Unknown user." };
  const session = await signedIn();
  if (!session) return { error: "You are signed out. Sign in and try again." };

  const { error } = await session.supabase.from("blocks").delete().eq("blocker_id", session.me).eq("blocked_id", userId);
  if (error) return { error: "Couldn't unblock this person. Try again." };

  revalidatePath("/", "layout");
  return {};
}

/** Form action for the Settings list of blocked people. */
export async function unblockFromForm(formData: FormData) {
  await unblockUser(String(formData.get("userId") ?? ""));
}

export async function reportUser(input: ReportInput): Promise<{ error?: string; message?: string }> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the report." };
  const session = await signedIn();
  if (!session) return { error: "You are signed out. Sign in and try again." };
  const { userId, messageId, reason, details } = parsed.data;
  if (userId === session.me) return { error: "You can't report yourself." };

  // Keep a copy of the reported message's text; RLS only returns it if the reporter can see it.
  let excerpt: string | undefined;
  if (messageId) {
    const { data } = await session.supabase
      .from("messages")
      .select("content, attachment_name")
      .eq("id", messageId)
      .eq("sender_id", userId)
      .maybeSingle();
    if (!data) return { error: "That message can't be reported." };
    excerpt = (data.content || (data.attachment_name ? `[file] ${data.attachment_name}` : "")).slice(0, EXCERPT_MAX);
  }

  const { error } = await session.supabase.from("reports").insert({
    reporter_id: session.me,
    reported_user_id: userId,
    message_id: messageId ?? null,
    reason,
    details: details ?? null,
    message_excerpt: excerpt ?? null,
  });
  if (error) return { error: "Couldn't send the report. Try again." };

  return { message: "Thanks. Your report was sent." };
}
