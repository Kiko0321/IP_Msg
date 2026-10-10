import { z } from "zod";

// Mirrors public.user_settings (MSG-21). Defaults apply when a user has never saved settings.
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const settingsSchema = z.object({
  theme: z.enum(THEMES, "Choose a theme."),
  notifyNewMessages: z.boolean(),
  notifySound: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  notifyNewMessages: true,
  notifySound: false,
};

// Checkboxes are absent from FormData when unchecked.
export function settingsFromFormData(formData: FormData) {
  return {
    theme: formData.get("theme"),
    notifyNewMessages: formData.get("notifyNewMessages") === "on",
    notifySound: formData.get("notifySound") === "on",
  };
}
