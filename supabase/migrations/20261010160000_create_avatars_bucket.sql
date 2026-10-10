-- MSG-09: avatar storage. Public read (avatars are shown to everyone), owner-only writes.
-- Files live at avatars/<user id>/<file>; the bucket enforces type and size server-side.
-- Safe to re-run.
set lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can list their own avatar files" on storage.objects;
create policy "Users can list their own avatar files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload avatars to their own folder" on storage.objects;
create policy "Users can upload avatars to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can replace their own avatar files" on storage.objects;
create policy "Users can replace their own avatar files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own avatar files" on storage.objects;
create policy "Users can delete their own avatar files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A profile may only point at an avatar inside its own folder, never an arbitrary URL.
alter table public.profiles
  drop constraint if exists profiles_avatar_url_own_folder;

alter table public.profiles
  add constraint profiles_avatar_url_own_folder
  check (avatar_url is null or avatar_url like 'https://%/storage/v1/object/public/avatars/' || id::text || '/%');
