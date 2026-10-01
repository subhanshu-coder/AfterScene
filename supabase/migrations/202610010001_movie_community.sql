create table public.movie_verdicts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  verdict text not null check (verdict in ('skip','time_pass','good','love')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);
create index movie_verdicts_movie_idx on public.movie_verdicts(movie_id);
alter table public.movie_verdicts enable row level security;
create policy "Movie verdicts are readable" on public.movie_verdicts for select using (true);
create policy "Users manage own movie verdicts" on public.movie_verdicts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.movie_verdicts to anon, authenticated;
grant insert, update, delete on public.movie_verdicts to authenticated;

create table public.movie_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null check (tmdb_id > 0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now()
);
create index movie_discussion_messages_room_idx on public.movie_discussion_messages(tmdb_id, created_at desc);
alter table public.movie_discussion_messages enable row level security;
create policy "Movie discussions are readable" on public.movie_discussion_messages for select using (true);
create policy "Users create their own movie messages" on public.movie_discussion_messages for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users delete their own movie messages" on public.movie_discussion_messages for delete using (user_id = (select auth.uid()));
grant select on public.movie_discussion_messages to anon, authenticated;
grant insert, delete on public.movie_discussion_messages to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.movie_discussion_messages;
exception when duplicate_object then null;
end $$;
