-- MSG-39: one file or image per message, stored in a private "attachments" bucket.
-- Files live at attachments/<conversation id>/<random uuid>.<ext>; only members of that
-- conversation can upload, list or open them (through short-lived signed URLs). Safe to re-run.

set lock_timeout = '5s';

-- Bucket ----------------------------------------------------------------------------------------
-- Keep in step with lib/validation/attachment.ts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760, -- 10 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the object's first folder is a conversation the caller belongs to. Checks the folder
-- is a uuid first, so a malformed path is simply denied instead of raising a cast error.
create or replace function public.can_access_attachment(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (storage.foldername(object_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_conversation_member(((storage.foldername(object_name))[1])::uuid),
    false
  );
$$;

revoke execute on function public.can_access_attachment(text) from public, anon;
grant execute on function public.can_access_attachment(text) to authenticated;

drop policy if exists "Members can read their conversations' attachments" on storage.objects;
create policy "Members can read their conversations' attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and public.can_access_attachment(name));

drop policy if exists "Members can upload attachments to their conversations" on storage.objects;
create policy "Members can upload attachments to their conversations"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments' and public.can_access_attachment(name));

-- Files are never replaced; only the uploader can delete theirs.
drop policy if exists "Uploaders can delete their attachments" on storage.objects;
create policy "Uploaders can delete their attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments' and owner_id = (select auth.uid())::text);

-- Messages --------------------------------------------------------------------------------------
alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size integer;

comment on column public.messages.attachment_path is 'Object name in the attachments bucket: <conversation id>/<uuid>.<ext>.';

-- All four set, or none; and the file must be in this conversation's folder.
alter table public.messages drop constraint if exists messages_attachment_complete;
alter table public.messages
  add constraint messages_attachment_complete check (
    (attachment_path is null and attachment_name is null and attachment_type is null and attachment_size is null)
    or (
      attachment_path like conversation_id::text || '/%'
      and char_length(attachment_name) between 1 and 200
      and attachment_size between 1 and 10485760
    )
  );

-- Text becomes optional when there's an attachment (it used to be 1-4000 characters, always).
alter table public.messages alter column content set default '';
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages
  add constraint messages_content_check check (
    char_length(btrim(content)) <= 4000
    and (char_length(btrim(content)) >= 1 or attachment_path is not null)
  );
