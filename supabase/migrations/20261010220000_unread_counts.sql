-- MSG-19: unread state per member, using conversation_members.last_read_at (MSG-10).
-- Both functions run as the caller (security invoker), so the MSG-12 RLS policies apply.
-- Counting uses the messages (conversation_id, created_at) index from MSG-11.
-- Safe to re-run.
set lock_timeout = '5s';

-- Unread messages per conversation for the signed-in user: messages from others newer than
-- their last_read_at. Conversations with nothing unread are omitted.
create or replace function public.unread_counts()
returns table (conversation_id uuid, unread bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.conversation_id, count(*) as unread
  from public.conversation_members cm
  join public.messages m
    on m.conversation_id = cm.conversation_id
   and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
   and m.sender_id <> cm.user_id
  where cm.user_id = (select auth.uid())
  group by m.conversation_id;
$$;

-- Marks a conversation read up to now (database clock), never moving backwards.
create or replace function public.mark_conversation_read(target uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.conversation_members
     set last_read_at = greatest(coalesce(last_read_at, '-infinity'::timestamptz), now())
   where conversation_id = target
     and user_id = (select auth.uid());
$$;

revoke execute on function public.unread_counts() from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.unread_counts() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

