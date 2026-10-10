-- MSG-10: conversations and their members.
-- RLS is enabled here with no policies (deny all) so the tables are never exposed without
-- protection; the membership-based policies are added in MSG-12.
-- Safe to re-run.
set lock_timeout = '5s';

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  -- Only group conversations have a title; direct ones show the other member's name.
  title text check (title is null or char_length(title) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Bumped by new messages (MSG-11) so the conversation list can sort by recent activity.
  last_message_at timestamptz,
  constraint conversations_direct_has_no_title check (kind = 'group' or title is null)
);

comment on table public.conversations is 'A direct (1:1) or group chat.';

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  -- Used for unread indicators (MSG-19).
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

comment on table public.conversation_members is 'Who belongs to which conversation.';

-- The primary key covers lookups by conversation; this covers "my conversations".
create index if not exists conversation_members_user_id_idx
  on public.conversation_members (user_id);

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;

-- Reuses set_updated_at() from the profiles migration (MSG-07).
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();
