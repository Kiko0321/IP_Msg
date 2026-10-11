// Shapes of chat rows as the UI uses them (subset of the public.messages / profiles columns).

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  // MSG-39: an optional file or image (all four set, or all null).
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
};

/** The columns every message query selects. */
export const MESSAGE_COLUMNS =
  "id, sender_id, content, created_at, edited_at, attachment_path, attachment_name, attachment_type, attachment_size";

export type ChatMember = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

// A message as shown in the list: saved rows plus the sender's own not-yet-saved ones.
export type DisplayMessage = ChatMessage & {
  status?: "sending" | "failed";
  /** Upload progress for the sender's own attachment, before it's saved. */
  localFile?: File;
};
