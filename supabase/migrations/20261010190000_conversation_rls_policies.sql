-- MSG-12: membership-based access for conversations, members and messages.
-- Requires MSG-10 (conversations, conversation_members) and MSG-11 (messages).
-- Safe to re-run.
set lock_timeout = '5s';

-- RLS on every table exposed through the API (profiles already has it from MSG-07).
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Helpers. SECURITY DEFINER so policies on conversation_members can check membership
-- without recursively applying conversation_members' own policies. They only ever
-- answer for the calling user (auth.uid()).
create or replace function public.is_conversation_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_conversation_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- True only while the caller's own new conversation has no members yet: lets the creator
-- add themselves as the first owner, and nothing else.
create or replace function public.can_bootstrap_conversation(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = target
      and c.created_by = (select auth.uid())
      and not exists (select 1 from public.conversation_members m where m.conversation_id = c.id)
  );
$$;

revoke execute on function public.is_conversation_member(uuid) from public, anon;
revoke execute on function public.is_conversation_owner(uuid) from public, anon;
revoke execute on function public.can_bootstrap_conversation(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.is_conversation_owner(uuid) to authenticated;
grant execute on function public.can_bootstrap_conversation(uuid) to authenticated;

-- conversations ---------------------------------------------------------------

drop policy if exists "Members can read their conversations" on public.conversations;
create policy "Members can read their conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id) or created_by = (select auth.uid()));

drop policy if exists "Users can create conversations as themselves" on public.conversations;
create policy "Users can create conversations as themselves"
  on public.conversations for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Owners can update their conversations" on public.conversations;
create policy "Owners can update their conversations"
  on public.conversations for update
  to authenticated
  using (public.is_conversation_owner(id))
  with check (public.is_conversation_owner(id));

-- Clients may only rename; kind, creator and timestamps are not theirs to change.
revoke update on public.conversations from authenticated;
grant update (title) on public.conversations to authenticated;

-- conversation_members --------------------------------------------------------

drop policy if exists "Members can see who is in their conversations" on public.conversation_members;
create policy "Members can see who is in their conversations"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

-- Owners add members. Nobody can join a conversation on their own, except the creator
-- adding themselves as the first owner of a brand-new conversation.
drop policy if exists "Owners can add members" on public.conversation_members;
create policy "Owners can add members"
  on public.conversation_members for insert
  to authenticated
  with check (
    public.is_conversation_owner(conversation_id)
    or (
      public.can_bootstrap_conversation(conversation_id)
      and user_id = (select auth.uid())
      and role = 'owner'
    )
  );

-- Members update only their own row, and only last_read_at (column grant below).
drop policy if exists "Members can update their own membership" on public.conversation_members;
create policy "Members can update their own membership"
  on public.conversation_members for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- Members can leave; owners can remove others.
drop policy if exists "Members can leave and owners can remove" on public.conversation_members;
create policy "Members can leave and owners can remove"
  on public.conversation_members for delete
  to authenticated
  using (user_id = (select auth.uid()) or public.is_conversation_owner(conversation_id));

-- messages ----------------------------------------------------------------------

drop policy if exists "Members can read messages" on public.messages;
create policy "Members can read messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists "Members can send messages as themselves" on public.messages;
create policy "Members can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

drop policy if exists "Senders can edit their messages" on public.messages;
create policy "Senders can edit their messages"
  on public.messages for update
  to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

revoke update on public.messages from authenticated;
grant update (content, edited_at) on public.messages to authenticated;

drop policy if exists "Senders can delete their messages" on public.messages;
create policy "Senders can delete their messages"
  on public.messages for delete
  to authenticated
  using (sender_id = (select auth.uid()));

-- Anonymous visitors get nothing from these tables.
revoke all on public.conversations, public.conversation_members, public.messages from anon;
