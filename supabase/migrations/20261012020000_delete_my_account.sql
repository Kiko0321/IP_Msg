-- MSG-44: lets a signed-in user delete their own account. Safe to re-run.
--
-- Deleting the auth user cascades through profiles to their memberships, messages, settings, blocks
-- and reports (all "on delete cascade"); conversations they created keep existing (created_by is
-- set null). Files in Storage can't be removed from SQL, so the app deletes them first through the
-- Storage API (app/(app)/profile/account-actions.ts).

set lock_timeout = '5s';

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  -- Groups this user owns get a new owner (the longest-standing other member), so the remaining
  -- members can still add people. Groups left with no one else are removed.
  update public.conversation_members heir
     set role = 'owner'
   where (heir.conversation_id, heir.user_id) in (
     select distinct on (m.conversation_id) m.conversation_id, m.user_id
     from public.conversation_members m
     join public.conversation_members mine
       on mine.conversation_id = m.conversation_id and mine.user_id = me and mine.role = 'owner'
     join public.conversations c on c.id = m.conversation_id and c.kind = 'group'
     where m.user_id <> me
       and not exists (
         select 1 from public.conversation_members o
         where o.conversation_id = m.conversation_id and o.user_id <> me and o.role = 'owner'
       )
     order by m.conversation_id, m.joined_at, m.user_id
   );

  delete from public.conversations c
   where c.kind = 'group'
     and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me)
     and not exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id <> me);

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
