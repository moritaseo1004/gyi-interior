create table if not exists public.app_states (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

drop policy if exists "authenticated can read app state" on public.app_states;
drop policy if exists "authenticated can insert app state" on public.app_states;
drop policy if exists "authenticated can update app state" on public.app_states;

create policy "authenticated can read app state"
on public.app_states
for select
to authenticated
using (id = 'main');

create policy "authenticated can insert app state"
on public.app_states
for insert
to authenticated
with check (id = 'main');

create policy "authenticated can update app state"
on public.app_states
for update
to authenticated
using (id = 'main')
with check (id = 'main');
