import { z } from "zod";

// Limits mirror the database checks on public.profiles.
export const DISPLAY_NAME_MAX = 50;
export const STATUS_MESSAGE_MAX = 140;

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name.")
    .max(DISPLAY_NAME_MAX, `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`),
  statusMessage: z
    .string()
    .trim()
    .max(STATUS_MESSAGE_MAX, `Status must be ${STATUS_MESSAGE_MAX} characters or fewer.`),
});

export type ProfileInput = z.infer<typeof profileSchema>;
