-- MSG-23: persisted "last seen". Live online status comes from Supabase Realtime Presence and is
-- not stored; last_seen_at is the fallback once a user goes offline. Safe to re-run.
set lock_timeout = '5s';

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is 'Last heartbeat from an open app tab (about every minute); null if never seen.';

-- Records "now" for the calling user only. Runs as the caller, so the profiles update policy applies.
create or replace function public.touch_last_seen()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles
     set last_seen_at = now()
   where id = (select auth.uid());
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
