import { z } from "zod";

// MSG-37: a new group chat. The title limit mirrors the check on public.conversations.title.
export const GROUP_TITLE_MAX = 80;
// Members besides the creator. Keeps one insert small and groups to a team-sized chat.
export const GROUP_MEMBERS_MAX = 49;

export const groupSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Name the group.")
    .max(GROUP_TITLE_MAX, `Group name must be ${GROUP_TITLE_MAX} characters or fewer.`),
  memberIds: z
    .array(z.uuid("Unknown member."))
    .min(1, "Choose at least one person.")
    .max(GROUP_MEMBERS_MAX, `A group can have up to ${GROUP_MEMBERS_MAX + 1} people, including you.`)
    .transform((ids) => [...new Set(ids)]),
});

export type GroupInput = z.input<typeof groupSchema>;

export function groupFromFormData(formData: FormData): GroupInput {
  return {
    title: String(formData.get("title") ?? ""),
    memberIds: formData.getAll("memberIds").map(String),
  };
}
