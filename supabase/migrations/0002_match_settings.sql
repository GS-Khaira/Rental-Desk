-- DDA Rental Desk: saved matching settings (one row per user)
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again: it skips anything that already exists.

create table if not exists public.match_settings (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings    jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.match_settings enable row level security;

drop trigger if exists match_settings_updated_at on public.match_settings;
create trigger match_settings_updated_at before update on public.match_settings
  for each row execute function public.set_updated_at();

drop policy if exists "own rows: select" on public.match_settings;
drop policy if exists "own rows: insert" on public.match_settings;
drop policy if exists "own rows: update" on public.match_settings;
drop policy if exists "own rows: delete" on public.match_settings;
create policy "own rows: select" on public.match_settings for select to authenticated using (user_id = auth.uid());
create policy "own rows: insert" on public.match_settings for insert to authenticated with check (user_id = auth.uid());
create policy "own rows: update" on public.match_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows: delete" on public.match_settings for delete to authenticated using (user_id = auth.uid());
