-- Little Stories private cloud backup setup
-- Run in the Supabase SQL editor for the shared One Little Teacher backend.

insert into storage.buckets (id, name, public)
values ('little-stories-backups', 'little-stories-backups', false)
on conflict (id) do update set public = false;

-- Each authenticated user can only access objects whose first path segment
-- equals their own auth user id: <user-id>/latest.littlestories.zip

create policy "Little Stories users can read own backups"
on storage.objects for select
to authenticated
using (
  bucket_id = 'little-stories-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Little Stories users can create own backups"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'little-stories-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Little Stories users can update own backups"
on storage.objects for update
to authenticated
using (
  bucket_id = 'little-stories-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'little-stories-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Little Stories users can delete own backups"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'little-stories-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
