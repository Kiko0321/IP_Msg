// Shapes of chat rows as the UI uses them (subset of the public.messages / profiles columns).

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
};

export type ChatMember = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

// A message as shown in the list: saved rows plus the sender's own not-yet-saved ones.
export type DisplayMessage = ChatMessage & { status?: "sending" | "failed" };
