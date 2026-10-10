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
