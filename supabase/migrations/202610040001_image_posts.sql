alter table public.posts add column if not exists image_path text;
alter table public.posts alter column body drop not null;
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts drop constraint if exists posts_body_content_or_image_check;
alter table public.posts add constraint posts_body_content_or_image_check
  check (
    (body is not null and char_length(body) between 1 and 5000)
    or image_path is not null
  );

drop policy if exists "Users create own posts" on public.posts;
create policy "Users create own posts" on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
  );

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public post images are readable" on storage.objects;
create policy "Public post images are readable" on storage.objects
  for select using (bucket_id = 'post-images');

drop policy if exists "Users upload own post images" on storage.objects;
create policy "Users upload own post images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete own post images" on storage.objects;
create policy "Users delete own post images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

grant select on public.posts to anon, authenticated;
grant insert on public.posts to authenticated;
