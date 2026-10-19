-- tAIsty cloud storage. Run once in Supabase: SQL Editor → New query → paste → Run.

-- One row per user holding that user's recipes, meal plan and grocery list.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row level security: every user can read and write only their own row.
alter table public.user_data enable row level security;

drop policy if exists "Users read their own data" on public.user_data;
create policy "Users read their own data" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert their own data" on public.user_data;
create policy "Users insert their own data" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update their own data" on public.user_data;
create policy "Users update their own data" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lets a signed-in user delete their own account (required by the App Store).
-- Deleting the auth user also deletes their user_data row (on delete cascade).
create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;
