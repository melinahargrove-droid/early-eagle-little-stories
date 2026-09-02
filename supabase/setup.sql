-- One Little Teacher shared private cloud backup setup
-- Run once in the shared Supabase project SQL editor.
-- Each app stores under: <user-id>/<app-namespace>/...

insert into storage.buckets (id, name, public)
values ('one-little-teacher-backups', 'one-little-teacher-backups', false)
on conflict (id) do update set public = false;

create policy "OLT users can read own backups"
on storage.objects for select
to authenticated
using (
  bucket_id = 'one-little-teacher-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "OLT users can create own backups"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'one-little-teacher-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "OLT users can update own backups"
on storage.objects for update
to authenticated
using (
  bucket_id = 'one-little-teacher-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'one-little-teacher-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "OLT users can delete own backups"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'one-little-teacher-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
