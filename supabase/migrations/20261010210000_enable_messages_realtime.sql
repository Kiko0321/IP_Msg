-- MSG-18: stream new messages to open chats with Supabase Realtime.
-- Realtime applies the messages RLS policies (MSG-12) per subscriber, so users only receive
-- messages from conversations they belong to. Safe to re-run.
set lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
