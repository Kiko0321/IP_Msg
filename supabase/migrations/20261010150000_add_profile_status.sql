-- MSG-08: optional status message shown next to a user's name.
alter table public.profiles
  add column status_message text check (char_length(status_message) <= 140);

comment on column public.profiles.status_message is 'Short status set by the user; null when empty.';
