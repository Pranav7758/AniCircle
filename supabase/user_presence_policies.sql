-- Run this in Supabase SQL editor to fix 403 on user_presence upserts.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

drop policy if exists "user_presence_insert_own" on public.user_presence;
create policy "user_presence_insert_own"
on public.user_presence
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_presence_update_own" on public.user_presence;
create policy "user_presence_update_own"
on public.user_presence
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_presence_select_friends" on public.user_presence;
create policy "user_presence_select_friends"
on public.user_presence
for select
to authenticated
using (
  exists (
    select 1
    from public.friends f
    where f.status = 'accepted'
      and (
        (f.user_id = auth.uid() and f.friend_id = user_presence.user_id)
        or
        (f.friend_id = auth.uid() and f.user_id = user_presence.user_id)
      )
  )
);
