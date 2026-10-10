-- MSG-11: messages in a conversation. Requires the conversations migration (MSG-10).
-- RLS is enabled with no policies (deny all); MSG-12 adds the membership policies.
-- Safe to re-run.
set lock_timeout = '5s';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- Set when a message is edited; null means never edited.
  edited_at timestamptz
);

comment on table public.messages is 'A chat message; sender_id is the author''s profile.';

-- Loading a conversation newest-first (and paging backwards) is the hot path.
create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);

create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

alter table public.messages enable row level security;

-- Keep conversations.last_message_at in step with the newest message.
create or replace function public.bump_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
   where id = new.conversation_id;
  return new;
end;
$$;

-- Only the trigger may call it.
revoke execute on function public.bump_conversation_last_message_at() from public, anon, authenticated;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message_at();
