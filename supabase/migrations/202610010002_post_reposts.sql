create table if not exists public.post_reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_reposts_user_created_idx on public.post_reposts(user_id, created_at desc);
alter table public.post_reposts enable row level security;
drop policy if exists "Visible post reposts are readable" on public.post_reposts;
drop policy if exists "Users manage own reposts" on public.post_reposts;
create policy "Visible post reposts are readable" on public.post_reposts for select using (
  exists (
    select 1 from public.posts p
    join public.profiles author on author.id = p.author_id
    where p.id = post_id and (not author.is_private or author.id = (select auth.uid()))
  )
);
create policy "Users manage own reposts" on public.post_reposts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select on public.post_reposts to anon, authenticated;
grant insert, delete on public.post_reposts to authenticated;
