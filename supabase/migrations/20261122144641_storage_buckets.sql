-- ============ Private storage buckets ============
-- Every object lives under "{user_id}/...", e.g. journal-media/{user_id}/{entry_id}/{uuid}.jpg
-- 50 MB per file = the Supabase free-plan global upload limit.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('journal-media', 'journal-media', false, 52428800, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]),
  ('journal-audio', 'journal-audio', false, 52428800, array[
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
    'audio/ogg', 'audio/webm', 'audio/flac'
  ]),
  ('profile-media', 'profile-media', false, 5242880, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif'
  ])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============ Owner-only access, by top-level folder ============
create policy "own_folder_select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('journal-media', 'journal-audio', 'profile-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('journal-media', 'journal-audio', 'profile-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('journal-media', 'journal-audio', 'profile-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('journal-media', 'journal-audio', 'profile-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own_folder_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('journal-media', 'journal-audio', 'profile-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
