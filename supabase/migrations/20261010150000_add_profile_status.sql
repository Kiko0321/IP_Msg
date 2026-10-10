-- MSG-08: optional status message shown next to a user's name.
-- Safe to re-run. Fails fast with a clear error if another session is holding a lock on profiles.
set lock_timeout = '5s';

alter table public.profiles
  add column if not exists status_message text;

alter table public.profiles
  drop constraint if exists profiles_status_message_length;

alter table public.profiles
  add constraint profiles_status_message_length check (char_length(status_message) <= 140);

comment on column public.profiles.status_message is 'Short status set by the user; null when empty.';
