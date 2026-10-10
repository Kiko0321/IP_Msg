-- Test data for LOCAL development (MSG-13). Loaded by `npm run db:reset` (local Supabase in Docker).
-- `supabase db push` does NOT run this; never load it into the hosted project: it creates users
-- with a known password.
--
-- Sign in with any of these, password "password123":
--   alice@example.test, bob@example.test, carol@example.test
--
-- Re-runnable: fixed ids plus "on conflict do nothing".

-- Users (the MSG-07 trigger creates their profiles).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.display_name),
  now(), now(), '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'alice@example.test', 'Alice'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bob@example.test', 'Bob'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'carol@example.test', 'Carol')
) as u (id, email, display_name)
on conflict (id) do nothing;

-- Email identities, required for password sign-in.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('alice@example.test', 'bob@example.test', 'carol@example.test')
on conflict (provider_id, provider) do nothing;

update public.profiles set status_message = 'Building IP Messenger' where id = '11111111-1111-4111-8111-111111111111';

-- A direct chat (Alice and Bob) and a group (all three).
insert into public.conversations (id, kind, title, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'direct', null, '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'group', 'Team', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.conversation_members (conversation_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'member')
on conflict do nothing;

-- Messages spread over the last hour so ordering is visible.
insert into public.messages (id, conversation_id, sender_id, content, created_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Hi Bob, are you there?', now() - interval '60 minutes'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Yes! What''s up?', now() - interval '58 minutes'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Testing the new messenger.', now() - interval '57 minutes'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'Welcome to the team chat.', now() - interval '30 minutes'),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Thanks Carol!', now() - interval '5 minutes')
on conflict (id) do nothing;
