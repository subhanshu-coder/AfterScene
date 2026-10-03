create table if not exists public.post_reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_reposts_user_created_idx on public.post_reposts(user_id, created_at desc);
alter table public.post_reposts enable row level security;
drop policy if exists "Post reposts are readable" on public.post_reposts;
create policy "Post reposts are readable" on public.post_reposts for select using (true);
drop policy if exists "Users manage own reposts" on public.post_reposts;
create policy "Users manage own reposts" on public.post_reposts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select on public.post_reposts to anon, authenticated;
grant insert, delete on public.post_reposts to authenticated;

drop policy if exists "Follows readable" on public.follows;
create policy "Follows readable" on public.follows for select using (
  follower_id = (select auth.uid())
  or followed_id = (select auth.uid())
  or (
    exists (select 1 from public.profiles follower where follower.id = follower_id and not follower.is_private)
    and exists (select 1 from public.profiles followed where followed.id = followed_id and not followed.is_private)
  )
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists review_comments_review_created_idx on public.review_comments(review_id, created_at);
alter table public.review_comments enable row level security;
drop policy if exists "Review replies are readable" on public.review_comments;
create policy "Review replies are readable" on public.review_comments for select using (true);
drop policy if exists "Users create own review replies" on public.review_comments;
create policy "Users create own review replies" on public.review_comments for insert to authenticated
  with check (author_id = (select auth.uid()));
drop policy if exists "Users delete own review replies" on public.review_comments;
create policy "Users delete own review replies" on public.review_comments for delete using (author_id = (select auth.uid()));
grant select on public.review_comments to anon, authenticated;
grant insert, delete on public.review_comments to authenticated;