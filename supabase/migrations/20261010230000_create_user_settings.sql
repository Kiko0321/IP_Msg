-- MSG-21: per-user preferences. A missing row means "all defaults", so existing users need no
-- backfill; the app upserts the row on the first save. Safe to re-run.
set lock_timeout = '5s';

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  -- Browser notifications for new messages while the app is open in another tab.
  notify_new_messages boolean not null default true,
  notify_sound boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is 'Per-user preferences (theme, notifications); one row per user, created on first save.';

alter table public.user_settings enable row level security;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
  on public.user_settings for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create their own settings" on public.user_settings;
create policy "Users can create their own settings"
  on public.user_settings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.user_settings from anon;

-- Reuses set_updated_at() from the profiles migration (MSG-07).
drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
