-- BodyMeasure tester study: run once in the Supabase SQL editor (Database → SQL editor → New query).
-- Photos are never stored; only numbers, ratings and comments.

create table if not exists public.testers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 200),
  email text not null,
  age_range text,
  sex text,
  consent_version text not null,
  consented_at timestamptz not null default now()
);

create table if not exists public.test_submissions (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the tester row (withdrawing from the study) deletes their submissions too.
  user_id uuid not null default auth.uid() references public.testers (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  app_version text not null,
  height_cm numeric not null check (height_cm between 100 and 230),
  side_photo boolean not null,
  measured jsonb not null,
  shown jsonb not null,
  tape jsonb not null default '{}',
  warnings jsonb not null default '[]',
  ease smallint check (ease between 1 and 5),
  trust smallint check (trust between 1 and 5),
  feedback text not null default '' check (char_length(feedback) <= 4000),
  device text not null default ''
);

create index if not exists test_submissions_user_id on public.test_submissions (user_id);

-- People who can see every tester's results. Add rows by hand (see docs/TESTING.md).
create table if not exists public.study_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_study_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.study_admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_study_admin() from public, anon;
grant execute on function public.is_study_admin() to authenticated;

alter table public.testers enable row level security;
alter table public.test_submissions enable row level security;
alter table public.study_admins enable row level security;
-- study_admins has no policies, so the app can only reach it through is_study_admin().

drop policy if exists "Testers read own row, admins read all" on public.testers;
create policy "Testers read own row, admins read all" on public.testers
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_study_admin()));

drop policy if exists "Testers create own row" on public.testers;
create policy "Testers create own row" on public.testers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Testers update own row" on public.testers;
create policy "Testers update own row" on public.testers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Testers delete own row" on public.testers;
create policy "Testers delete own row" on public.testers
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Testers read own tests, admins read all" on public.test_submissions;
create policy "Testers read own tests, admins read all" on public.test_submissions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_study_admin()));

drop policy if exists "Testers add own tests" on public.test_submissions;
create policy "Testers add own tests" on public.test_submissions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Testers delete own tests" on public.test_submissions;
create policy "Testers delete own tests" on public.test_submissions
  for delete to authenticated
  using (user_id = (select auth.uid()));
