alter table public.posts add column if not exists image_path text;
alter table public.posts drop constraint if exists posts_body_length_check;
alter table public.posts add constraint posts_body_length_check check (body is null or char_length(body) <= 5000);

create table if not exists public.post_reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'love',
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists post_reposts_user_idx on public.post_reposts(user_id, created_at desc);
create index if not exists review_comments_review_created_idx on public.review_comments(review_id, created_at);
create index if not exists comment_reactions_comment_idx on public.comment_reactions(comment_id);

alter table public.post_reposts enable row level security;
alter table public.review_comments enable row level security;
alter table public.comment_reactions enable row level security;

drop policy if exists "Reposts are visible to signed in users" on public.post_reposts;
create policy "Reposts are visible to signed in users" on public.post_reposts for select to authenticated using (true);
drop policy if exists "Users create their own reposts" on public.post_reposts;
create policy "Users create their own reposts" on public.post_reposts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users remove their own reposts" on public.post_reposts;
create policy "Users remove their own reposts" on public.post_reposts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Review comments are visible" on public.review_comments;
create policy "Review comments are visible" on public.review_comments for select to authenticated using (true);
drop policy if exists "Users create review comments" on public.review_comments;
create policy "Users create review comments" on public.review_comments for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "Users delete their own review comments" on public.review_comments;
create policy "Users delete their own review comments" on public.review_comments for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists "Comment reactions are visible" on public.comment_reactions;
create policy "Comment reactions are visible" on public.comment_reactions for select to authenticated using (true);
drop policy if exists "Users create their own comment reactions" on public.comment_reactions;
create policy "Users create their own comment reactions" on public.comment_reactions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users delete their own comment reactions" on public.comment_reactions;
create policy "Users delete their own comment reactions" on public.comment_reactions for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.post_reposts to authenticated;
grant select, insert, delete on public.review_comments to authenticated;
grant select, insert, delete on public.comment_reactions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Public post images are readable" on storage.objects;
create policy "Public post images are readable" on storage.objects for select to public using (bucket_id = 'post-images');
drop policy if exists "Users upload their own post images" on storage.objects;
create policy "Users upload their own post images" on storage.objects for insert to authenticated with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete their own post images" on storage.objects;
create policy "Users delete their own post images" on storage.objects for delete to authenticated using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
