"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { groupFromFormData, groupSchema, type GroupInput } from "@/lib/validation/group";

export type GroupState = {
  values?: GroupInput;
  fieldErrors?: Partial<Record<keyof GroupInput, string[]>>;
  error?: string;
};

// MSG-37: creates a group chat and opens it. Uses the MSG-12 policies as they are: the creator
// inserts the conversation, adds themselves as its first owner, and then (as owner) the others.
export async function createGroup(_prev: GroupState, formData: FormData): Promise<GroupState> {
  const values = groupFromFormData(formData);
  const parsed = groupSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");
  const me = auth.claims.sub;

  const memberIds = parsed.data.memberIds.filter((id) => id !== me);
  if (memberIds.length === 0) return { values, fieldErrors: { memberIds: ["Choose at least one person."] } };

  // Check everyone still exists first, so the group isn't left half-made by a failed insert below.
  const { data: found } = await supabase.from("profiles").select("id").in("id", memberIds);
  if ((found?.length ?? 0) !== memberIds.length) {
    return { values, error: "Some of the people you chose are no longer available. Reload and try again." };
  }

  const { data: group, error: createError } = await supabase
    .from("conversations")
    .insert({ kind: "group", title: parsed.data.title, created_by: me })
    .select("id")
    .single();
  if (createError || !group) return { values, error: "Couldn't create the group. Try again." };

  const { error: ownerError } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: group.id, user_id: me, role: "owner" });
  if (ownerError) return { values, error: "Couldn't create the group. Try again." };

  const { error: membersError } = await supabase
    .from("conversation_members")
    .insert(memberIds.map((user_id) => ({ conversation_id: group.id, user_id, role: "member" })));

  revalidatePath("/", "layout");
  // The group exists either way, so open it rather than invite a retry that would make a second one.
  if (membersError) redirect(`/chat/${group.id}?notice=members-failed`);
  redirect(`/chat/${group.id}`);
}
