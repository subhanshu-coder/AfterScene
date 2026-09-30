create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.watch_status as enum ('want_to_watch', 'watching', 'watched', 'dropped', 'favorite');
create type public.post_kind as enum ('opinion', 'review', 'recommendation', 'question', 'reaction', 'discussion');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_url text,
  role public.user_role not null default 'user',
  is_private boolean not null default false,
  spoiler_free boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mood text,
  cinema_preferences text[] not null default '{}',
  notification_preferences jsonb not null default '{"follows":true,"reactions":true,"comments":true,"messages":true}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null unique check (tmdb_id > 0),
  media_type text not null default 'movie' check (media_type in ('movie','tv')),
  title text not null,
  poster_path text,
  backdrop_path text,
  release_date date,
  genres integer[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index movies_title_search_idx on public.movies using gin (to_tsvector('simple', title));
create index movies_release_date_idx on public.movies(release_date desc);

create table public.user_genres (
  user_id uuid not null references public.profiles(id) on delete cascade,
  genre_id integer not null,
  weight numeric(5,2) not null default 1 check (weight between 0 and 100),
  primary key (user_id, genre_id)
);
create table public.movie_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  rating numeric(2,1) not null check (rating between 0.5 and 5.0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);
create index movie_ratings_movie_idx on public.movie_ratings(movie_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind public.post_kind not null default 'opinion',
  body text not null check (char_length(body) between 1 and 5000),
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_author_created_idx on public.posts(author_id, created_at desc);
create index posts_created_idx on public.posts(created_at desc);
create table public.post_movies (
  post_id uuid not null references public.posts(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  primary key(post_id, movie_id)
);
create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('fire','love','cry','shock','laugh','sleep','think')),
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_created_idx on public.comments(post_id, created_at);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  rating numeric(2,1) not null check (rating between 0.5 and 5.0),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 10000),
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(author_id, movie_id)
);
create index reviews_movie_created_idx on public.reviews(movie_id, created_at desc);
create table public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(review_id, user_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index follows_followed_idx on public.follows(followed_id);
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.watchlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  status public.watch_status not null default 'want_to_watch',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, movie_id)
);
create index watchlists_user_status_idx on public.watchlists(user_id, status, position);
create table public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  watched_on date not null default current_date,
  rating numeric(2,1) check (rating between 0.5 and 5.0),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index watch_history_user_date_idx on public.watch_history(user_id, watched_on desc);
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_public_idx on public.collections(created_at desc) where is_public;
create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key(collection_id, movie_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('follow','reaction','comment','reply','review_helpful','message','watch_party')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc) where read_at is null;

create table public.movie_dna_snapshots (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare safe_username text;
begin
  safe_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(safe_username) < 3 or char_length(safe_username) > 24 or exists(select 1 from public.profiles p where p.username = safe_username) then
    safe_username := 'film_' || substr(new.id::text, 1, 8);
  end if;
  insert into public.profiles(id, username, display_name)
  values(new.id, safe_username, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), safe_username));
  insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;
grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.movies enable row level security;
alter table public.user_genres enable row level security;
alter table public.movie_ratings enable row level security;
alter table public.posts enable row level security;
alter table public.post_movies enable row level security;
alter table public.post_reactions enable row level security;
alter table public.comments enable row level security;
alter table public.reviews enable row level security;
alter table public.review_helpful_votes enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.watchlists enable row level security;
alter table public.watch_history enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.notifications enable row level security;
alter table public.movie_dna_snapshots enable row level security;

create policy "Profiles are viewable" on public.profiles for select using (is_private = false or id = (select auth.uid()));
create policy "Users update own profile" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = public.current_user_role());
create policy "Movies are readable" on public.movies for select using (true);
create policy "Authenticated users add movies" on public.movies for insert to authenticated with check (true);
create policy "Users read own preferences" on public.user_preferences for select using (user_id = (select auth.uid()));
create policy "Users manage own preferences" on public.user_preferences for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own genres" on public.user_genres for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Ratings are readable" on public.movie_ratings for select using (true);
create policy "Users manage own ratings" on public.movie_ratings for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Public posts are readable" on public.posts for select using (exists (select 1 from public.profiles p where p.id = author_id and (not p.is_private or p.id = (select auth.uid()))));
create policy "Users create own posts" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Users update own posts" on public.posts for update using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Users delete own posts" on public.posts for delete using (author_id = (select auth.uid()));
create policy "Post movie links readable" on public.post_movies for select using (true);
create policy "Post authors link movies" on public.post_movies for insert to authenticated with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
create policy "Reactions readable" on public.post_reactions for select using (true);
create policy "Users manage own reactions" on public.post_reactions for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Comments readable" on public.comments for select using (exists(select 1 from public.posts p where p.id = post_id));
create policy "Users create own comments" on public.comments for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Users delete own comments" on public.comments for delete using (author_id = (select auth.uid()));
create policy "Reviews readable" on public.reviews for select using (true);
create policy "Users manage own reviews" on public.reviews for all using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Helpful votes readable" on public.review_helpful_votes for select using (true);
create policy "Users manage own helpful votes" on public.review_helpful_votes for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Follows readable" on public.follows for select using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));
create policy "Users manage own follows" on public.follows for all using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()) and follower_id <> followed_id);
create policy "Users manage own blocks" on public.blocks for all using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id);
create policy "Users manage own watchlist" on public.watchlists for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own watch history" on public.watch_history for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Public collections readable" on public.collections for select using (is_public or owner_id = (select auth.uid()));
create policy "Users manage own collections" on public.collections for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Collection items readable when collection is visible" on public.collection_items for select using (exists(select 1 from public.collections c where c.id = collection_id and (c.is_public or c.owner_id = (select auth.uid()))));
create policy "Collection owners manage items" on public.collection_items for all using (exists(select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid()))) with check (exists(select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));
create policy "Users read own notifications" on public.notifications for select using (recipient_id = (select auth.uid()));
create policy "Users update own notifications" on public.notifications for update using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "Users read own Movie DNA" on public.movie_dna_snapshots for select using (user_id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.movies, public.profiles, public.movie_ratings, public.reviews, public.post_reactions, public.comments, public.collections, public.collection_items to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
