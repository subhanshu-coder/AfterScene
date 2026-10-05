create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'love' check (reaction = 'love'),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_reactions_comment_idx on public.comment_reactions(comment_id);
alter table public.comment_reactions enable row level security;
drop policy if exists "Comment reactions are readable" on public.comment_reactions;
create policy "Comment reactions are readable" on public.comment_reactions for select using (true);
drop policy if exists "Users manage own comment reactions" on public.comment_reactions;
create policy "Users manage own comment reactions" on public.comment_reactions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select on public.comment_reactions to anon, authenticated;
grant insert, delete on public.comment_reactions to authenticated;