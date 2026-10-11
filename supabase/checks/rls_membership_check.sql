-- MSG-12 check: members can read and send; non-members cannot read, send or join.
-- MSG-37: a creator can build a group (conversation, self as owner, members); only the owner adds people.
-- MSG-39: only members can upload or see a conversation's attachments; messages can't point elsewhere.
--
-- Run it either way:
--   npx supabase db query --linked -f supabase/checks/rls_membership_check.sql
--   or paste it into the Supabase SQL Editor.
--
-- It is one DO statement (no BEGIN/ROLLBACK, which the SQL Editor's backend doesn't handle well).
-- All test data is created inside an inner block that is always rolled back, so no users,
-- conversations or messages are left behind.
-- Success: the result is "PASS ...". Failure: the run stops with a "FAIL: ..." error.

do $check$
declare
  member_id constant uuid := '00000000-0000-4000-8000-0000000000a1';
  outsider_id constant uuid := '00000000-0000-4000-8000-0000000000b2';
  chat_id constant uuid := '00000000-0000-4000-8000-0000000000c3';
  group_id constant uuid := '00000000-0000-4000-8000-0000000000d4';
  stranger_id constant uuid := '00000000-0000-4000-8000-0000000000e5';
  n int;
begin
  begin
    -- Setup, as the database owner. Profiles come from the sign-up trigger (MSG-07).
    insert into auth.users (id, email, raw_user_meta_data, aud, role) values
      (member_id, 'rls-member@example.test', '{"display_name":"Member"}', 'authenticated', 'authenticated'),
      (outsider_id, 'rls-outsider@example.test', '{"display_name":"Outsider"}', 'authenticated', 'authenticated'),
      (stranger_id, 'rls-stranger@example.test', '{"display_name":"Stranger"}', 'authenticated', 'authenticated');
    insert into public.conversations (id, kind, created_by) values (chat_id, 'direct', member_id);
    insert into public.conversation_members (conversation_id, user_id, role) values (chat_id, member_id, 'owner');
    insert into public.messages (conversation_id, sender_id, content) values (chat_id, member_id, 'secret');

    -- Act as a signed-in API user (reverted with the rollback below).
    perform set_config('role', 'authenticated', true);

    -- 1) The member can read and send.
    perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
    select count(*) into n from public.messages where conversation_id = chat_id;
    if n <> 1 then raise exception 'FAIL: member sees % message(s), expected 1', n; end if;
    insert into public.messages (conversation_id, sender_id, content) values (chat_id, member_id, 'hello');

    -- 2) The outsider can't read, see, join, send, or send as someone else.
    perform set_config('request.jwt.claims', json_build_object('sub', outsider_id, 'role', 'authenticated')::text, true);

    select count(*) into n from public.messages where conversation_id = chat_id;
    if n <> 0 then raise exception 'FAIL: non-member can read % message(s)', n; end if;

    select count(*) into n from public.conversations where id = chat_id;
    if n <> 0 then raise exception 'FAIL: non-member can see the conversation'; end if;

    select count(*) into n from public.conversation_members where conversation_id = chat_id;
    if n <> 0 then raise exception 'FAIL: non-member can see the member list'; end if;

    begin
      insert into public.messages (conversation_id, sender_id, content) values (chat_id, outsider_id, 'let me in');
      raise exception 'FAIL: non-member could send a message';
    exception when insufficient_privilege then null; -- RLS rejection, as expected
    end;

    begin
      insert into public.conversation_members (conversation_id, user_id) values (chat_id, outsider_id);
      raise exception 'FAIL: non-member could join the conversation';
    exception when insufficient_privilege then null;
    end;

    begin
      insert into public.messages (conversation_id, sender_id, content) values (chat_id, member_id, 'spoofed');
      raise exception 'FAIL: non-member could send as someone else';
    exception when insufficient_privilege then null;
    end;

    -- 3) MSG-37: creating a group the way the app does: the conversation, then the creator as
    --    owner, then the others. Afterwards members can read it, but only the owner can add people.
    perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
    insert into public.conversations (id, kind, title, created_by) values (group_id, 'group', 'Check group', member_id);
    insert into public.conversation_members (conversation_id, user_id, role) values (group_id, member_id, 'owner');
    insert into public.conversation_members (conversation_id, user_id, role) values (group_id, outsider_id, 'member');

    perform set_config('request.jwt.claims', json_build_object('sub', outsider_id, 'role', 'authenticated')::text, true);
    select count(*) into n from public.conversations where id = group_id;
    if n <> 1 then raise exception 'FAIL: an added group member can''t see the group'; end if;
    insert into public.messages (conversation_id, sender_id, content) values (group_id, outsider_id, 'hi all');

    begin
      insert into public.conversation_members (conversation_id, user_id) values (group_id, stranger_id);
      raise exception 'FAIL: a group member who isn''t the owner could add people';
    exception when insufficient_privilege then null;
    end;

    perform set_config('request.jwt.claims', json_build_object('sub', stranger_id, 'role', 'authenticated')::text, true);
    begin
      insert into public.conversation_members (conversation_id, user_id, role) values (group_id, stranger_id, 'owner');
      raise exception 'FAIL: an outsider could make themselves owner of someone else''s group';
    exception when insufficient_privilege then null;
    end;

    -- 4) MSG-39: attachments live in the conversation's folder of the private "attachments" bucket.
    perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
    insert into storage.objects (bucket_id, name, owner_id)
      values ('attachments', chat_id::text || '/00000000-0000-4000-8000-0000000000f6.png', member_id::text);
    insert into public.messages (conversation_id, sender_id, content, attachment_path, attachment_name, attachment_type, attachment_size)
      values (chat_id, member_id, '', chat_id::text || '/00000000-0000-4000-8000-0000000000f6.png', 'photo.png', 'image/png', 1024);

    begin
      insert into public.messages (conversation_id, sender_id, content, attachment_path, attachment_name, attachment_type, attachment_size)
        values (chat_id, member_id, '', group_id::text || '/00000000-0000-4000-8000-0000000000f7.png', 'x.png', 'image/png', 1);
      raise exception 'FAIL: a message could point at another conversation''s file';
    exception when check_violation then null;
    end;

    begin
      insert into public.messages (conversation_id, sender_id, content) values (chat_id, member_id, '   ');
      raise exception 'FAIL: an empty message without a file was accepted';
    exception when check_violation then null;
    end;

    perform set_config('request.jwt.claims', json_build_object('sub', stranger_id, 'role', 'authenticated')::text, true);
    select count(*) into n from storage.objects where bucket_id = 'attachments' and name like chat_id::text || '/%';
    if n <> 0 then raise exception 'FAIL: a non-member can see % attachment(s)', n; end if;

    begin
      insert into storage.objects (bucket_id, name, owner_id)
        values ('attachments', chat_id::text || '/00000000-0000-4000-8000-0000000000f8.png', stranger_id::text);
      raise exception 'FAIL: a non-member could upload into a conversation';
    exception when insufficient_privilege then null;
    end;

    -- Everything passed: undo all of the above.
    raise exception using errcode = 'P0001', message = 'rls-check-rollback';
  exception
    when others then
      if sqlerrm <> 'rls-check-rollback' then
        raise; -- a real FAIL or unexpected error
      end if;
  end;
end;
$check$;

select 'PASS: members can read/send; non-members cannot read, send or join; groups: creator builds, only owner adds; attachments: members only' as result;
