-- MSG-12 check: members can read and send; non-members cannot read, send or join.
-- Paste into the Supabase SQL Editor and run. Everything happens inside a transaction that is
-- rolled back, so no users, conversations or messages are left behind.
-- Success: the last result is "PASS ...". Failure: the run stops with a "FAIL: ..." error.

begin;

-- Throwaway users; their profiles are created by the sign-up trigger (MSG-07).
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000a1', 'rls-member@example.test', '{"display_name":"Member"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'rls-outsider@example.test', '{"display_name":"Outsider"}', 'authenticated', 'authenticated');

-- A private conversation with one member and one message (set up as the database owner).
insert into public.conversations (id, kind, created_by)
values ('00000000-0000-4000-8000-0000000000c3', 'direct', '00000000-0000-4000-8000-0000000000a1');
insert into public.conversation_members (conversation_id, user_id, role)
values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', 'owner');
insert into public.messages (conversation_id, sender_id, content)
values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', 'secret');

-- From here on, act as a signed-in API user.
set local role authenticated;

-- 1) The member can read and send.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.messages where conversation_id = '00000000-0000-4000-8000-0000000000c3';
  if n <> 1 then raise exception 'FAIL: member sees % message(s), expected 1', n; end if;

  insert into public.messages (conversation_id, sender_id, content)
  values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', 'hello');
end $$;

-- 2) The outsider can't read, send or join.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.messages where conversation_id = '00000000-0000-4000-8000-0000000000c3';
  if n <> 0 then raise exception 'FAIL: non-member can read % message(s)', n; end if;

  select count(*) into n from public.conversations where id = '00000000-0000-4000-8000-0000000000c3';
  if n <> 0 then raise exception 'FAIL: non-member can see the conversation'; end if;

  select count(*) into n from public.conversation_members where conversation_id = '00000000-0000-4000-8000-0000000000c3';
  if n <> 0 then raise exception 'FAIL: non-member can see the member list'; end if;

  begin
    insert into public.messages (conversation_id, sender_id, content)
    values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000b2', 'let me in');
    raise exception 'FAIL: non-member could send a message';
  exception when insufficient_privilege then null; -- RLS rejection, as expected
  end;

  begin
    insert into public.conversation_members (conversation_id, user_id)
    values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000b2');
    raise exception 'FAIL: non-member could join the conversation';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.messages (conversation_id, sender_id, content)
    values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', 'spoofed');
    raise exception 'FAIL: non-member could send as someone else';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;

select 'PASS: members can read/send; non-members cannot read, send or join' as result;
