-- MSG-43: blocking and reporting users. Safe to re-run.
--
-- Blocks: private to the blocker. While either person blocks the other, neither can start a
-- direct chat with the other or send messages in their direct chat. Group chats are unaffected.
-- Reports: users file them and can see only their own; they're reviewed in the Supabase Dashboard.

set lock_timeout = '5s';

-- Blocks ---------------------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.blocks is 'Who has blocked whom. Only the blocker can see their rows.';

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "Users see who they blocked" on public.blocks;
create policy "Users see who they blocked"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "Users block as themselves" on public.blocks;
create policy "Users block as themselves"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists "Users unblock their own blocks" on public.blocks;
create policy "Users unblock their own blocks"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon;
revoke update on public.blocks from authenticated;

-- True if the caller and `other` have blocked each other in either direction. SECURITY DEFINER so
-- it can see the other person's block, which RLS hides from the caller; it only answers yes/no.
create or replace function public.is_blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = (select auth.uid()) and blocked_id = other)
       or (blocker_id = other and blocked_id = (select auth.uid()))
  );
$$;

-- True if `target` is a direct chat whose other member is blocked with the caller.
create or replace function public.is_direct_chat_blocked(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id
    where c.id = target
      and c.kind = 'direct'
      and m.user_id <> (select auth.uid())
      and public.is_blocked_with(m.user_id)
  );
$$;

revoke execute on function public.is_blocked_with(uuid) from public, anon;
revoke execute on function public.is_direct_chat_blocked(uuid) from public, anon;
grant execute on function public.is_blocked_with(uuid) to authenticated;
grant execute on function public.is_direct_chat_blocked(uuid) to authenticated;

-- Sending (replaces the MSG-12 policy): also not in a direct chat with a block either way.
drop policy if exists "Members can send messages as themselves" on public.messages;
create policy "Members can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
    and not public.is_direct_chat_blocked(conversation_id)
  );

-- Starting a direct chat (replaces MSG-14's function): refused while blocked either way.
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
  if public.is_blocked_with(other_user) then
    raise exception 'You can''t message this person' using errcode = '42501';
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

-- Reports --------------------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  -- Kept so the report still makes sense if the message is later deleted.
  message_excerpt text check (message_excerpt is null or char_length(message_excerpt) <= 500),
  created_at timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_user_id)
);

comment on table public.reports is 'User reports, reviewed by admins in the Dashboard. Reporters see only their own.';

alter table public.reports enable row level security;

drop policy if exists "Users file reports as themselves" on public.reports;
create policy "Users file reports as themselves"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists "Users see their own reports" on public.reports;
create policy "Users see their own reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

revoke all on public.reports from anon;
revoke update, delete on public.reports from authenticated;
