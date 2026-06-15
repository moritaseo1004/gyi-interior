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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-files',
  'quote-files',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated can read quote files" on storage.objects;
drop policy if exists "authenticated can upload quote files" on storage.objects;
drop policy if exists "authenticated can update quote files" on storage.objects;
drop policy if exists "authenticated can delete quote files" on storage.objects;

create policy "authenticated can read quote files"
on storage.objects
for select
to authenticated
using (bucket_id = 'quote-files');

create policy "authenticated can upload quote files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'quote-files');

create policy "authenticated can update quote files"
on storage.objects
for update
to authenticated
using (bucket_id = 'quote-files')
with check (bucket_id = 'quote-files');

create policy "authenticated can delete quote files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'quote-files');
