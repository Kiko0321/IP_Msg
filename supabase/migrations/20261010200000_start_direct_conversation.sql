-- MSG-14: open (or reuse) a direct conversation with another user from the contact directory.
-- RLS only lets a creator add themselves (MSG-12), so creating a 1:1 chat with both members is
-- done here in one transaction. Safe to re-run.
set lock_timeout = '5s';

create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  conversation uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if other_user is null or other_user = me then
    raise exception 'Choose another user to message' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  -- Serialize per pair so two clicks (or both users at once) can't create duplicates.
  perform pg_advisory_xact_lock(
    hashtextextended(least(me, other_user)::text || greatest(me, other_user)::text, 0)
  );

  select c.id into conversation
  from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me)
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = other_user)
  limit 1;

  if conversation is null then
    insert into public.conversations (kind, created_by)
    values ('direct', me)
    returning id into conversation;

    insert into public.conversation_members (conversation_id, user_id, role)
    values (conversation, me, 'owner'), (conversation, other_user, 'member');
  end if;

  return conversation;
end;
$$;

revoke execute on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
