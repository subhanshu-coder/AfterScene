delete from public.follows where follower_id = followed_id;
alter table public.follows drop constraint if exists follows_no_self_follow;
alter table public.follows add constraint follows_no_self_follow check (follower_id <> followed_id);
