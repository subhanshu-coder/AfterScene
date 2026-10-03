import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, CalendarDays, Clapperboard, Heart, MessageCircle, Newspaper, Repeat2, Send, Sparkles, Star, Users, Video } from 'lucide-react';
import { getMovieSchedule, getMovieTrailers } from '../services/movies';
import type { Movie } from '../types/movie';
import { supabase } from '../lib/supabase';

type Space = 'Feed' | 'News' | 'Discussions' | 'Trailers' | 'Reviews' | 'Collections';
type Profile = { id: string; username: string; display_name: string; avatar_url?: string | null };
type Comment = { id: string; author_id: string; body: string; created_at: string; profile?: Profile };
type Post = { id: string; author_id: string; kind: string; body: string; is_spoiler: boolean; created_at: string; profile?: Profile; liked: boolean; likes: number; reposted: boolean; reposts: number; followed: boolean; comments: Comment[] };

type ReviewComment = { id: string; review_id: string; author_id: string; body: string; created_at: string; profile?: Profile };
type Review = { id: string; author_id: string; movie_id: string; title: string | null; body: string; rating: number; created_at: string; profile?: Profile; movie?: { title: string; tmdb_id: number; poster_path: string | null }; comments: ReviewComment[] };
type Collection = { id: string; owner_id: string; title: string; description: string; created_at: string; profile?: Profile; items: number };

const spaces: { name: Space; icon: typeof Users }[] = [
  { name: 'Feed', icon: Users }, { name: 'News', icon: Newspaper }, { name: 'Discussions', icon: MessageCircle },
  { name: 'Trailers', icon: Video }, { name: 'Reviews', icon: Star }, { name: 'Collections', icon: Bookmark },
];

function databaseMessage(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.code === 'PGRST205') return 'The community tables are missing in Supabase. Apply the project migrations, then retry.';
  if (error.code === '42501') return 'Supabase denied access. Check the posts read policy and authenticated grants.';
  if (error.code === 'PGRST200') return 'Supabase could not resolve a table relationship. Refresh the schema cache or apply the latest migration.';
  return `Community data could not load${error.code ? ` (${error.code})` : ''}. Check the Supabase project and try again.`;
}

async function getProfiles(ids: string[]) {
  if (!supabase || ids.length === 0) return new Map<string, Profile>();
  const { data, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', [...new Set(ids)]);
  if (error) throw new Error(databaseMessage(error));
  return new Map(((data ?? []) as Profile[]).map((profile) => [profile.id, profile]));
}

async function getPosts(space: Space, userId: string | null): Promise<Post[]> {
  if (!supabase) throw new Error('Supabase is not configured for this deployment. Add the VITE_SUPABASE_URL and publishable key.');
  let request = supabase.from('posts').select('id,author_id,kind,body,is_spoiler,created_at').order('created_at', { ascending: false }).limit(40);
  if (space === 'Discussions') request = request.in('kind', ['discussion', 'question']);
  const { data, error } = await request;
  if (error) throw new Error(databaseMessage(error));
  const base = data ?? [];
  if (base.length === 0) return [];
  const ids = base.map((post) => post.id);
  const authorIds = base.map((post) => post.author_id);
  const [profiles, reactionsResult, repostsResult, commentsResult, followsResult] = await Promise.all([
    getProfiles(authorIds),
    supabase.from('post_reactions').select('post_id,user_id,reaction').in('post_id', ids),
    supabase.from('post_reposts').select('post_id,user_id').in('post_id', ids),
    supabase.from('comments').select('id,post_id,author_id,body,created_at').in('post_id', ids).order('created_at', { ascending: true }),
    userId ? supabase.from('follows').select('followed_id').eq('follower_id', userId) : Promise.resolve({ data: [], error: null }),
  ]);
  if (reactionsResult.error) throw new Error(databaseMessage(reactionsResult.error));
  if (commentsResult.error) throw new Error(databaseMessage(commentsResult.error));
  const comments = commentsResult.data ?? [];
  const commentProfiles = await getProfiles(comments.map((comment) => comment.author_id));
  const followedIds = new Set((followsResult.data ?? []).map((row) => row.followed_id));
  const reposters = repostsResult.error ? [] : repostsResult.data ?? [];
  return base.map((post) => {
    const likes = (reactionsResult.data ?? []).filter((row) => row.post_id === post.id && row.reaction === 'love');
    const postReposts = reposters.filter((row) => row.post_id === post.id);
    return {
      ...post,
      profile: profiles.get(post.author_id),
      liked: likes.some((row) => row.user_id === userId),
      likes: likes.length,
      reposted: postReposts.some((row) => row.user_id === userId),
      reposts: postReposts.length,
      followed: followedIds.has(post.author_id),
      comments: comments.filter((comment) => comment.post_id === post.id).map((comment) => ({ ...comment, profile: commentProfiles.get(comment.author_id) })),
    };
  }) as Post[];
}

async function getReviews(): Promise<Review[]> {
  if (!supabase) throw new Error('Supabase is not configured for this deployment.');
  const { data, error } = await supabase.from('reviews').select('id,author_id,movie_id,title,body,rating,created_at').order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error(databaseMessage(error));
  const items = data ?? [];
  const [profiles, movies, commentResult] = await Promise.all([
    getProfiles(items.map((item) => item.author_id)),
    (async () => {
      const ids = [...new Set(items.map((item) => item.movie_id))];
      if (ids.length === 0) return new Map<string, Review['movie']>();
      const result = await supabase!.from('movies').select('id,title,tmdb_id,poster_path').in('id', ids);
      if (result.error) throw new Error(databaseMessage(result.error));
      return new Map((result.data ?? []).map((movie) => [movie.id, movie]));
    })(),
    supabase.from('review_comments').select('id,review_id,author_id,body,created_at').in('review_id', items.map((item) => item.id)).order('created_at', { ascending: true }),
  ]);
  if (commentResult.error) throw new Error(databaseMessage(commentResult.error));
  const commentRows = commentResult.data ?? [];
  const commentProfiles = await getProfiles(commentRows.map((comment) => comment.author_id));
  return items.map((item) => ({ ...item, profile: profiles.get(item.author_id), movie: movies.get(item.movie_id), comments: commentRows.filter((comment) => comment.review_id === item.id).map((comment) => ({ ...comment, profile: commentProfiles.get(comment.author_id) })) })) as Review[];
}

async function getCollections(): Promise<Collection[]> {
  if (!supabase) throw new Error('Supabase is not configured for this deployment.');
  const { data, error } = await supabase.from('collections').select('id,owner_id,title,description,created_at').eq('is_public', true).order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error(databaseMessage(error));
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const [profiles, items] = await Promise.all([
    getProfiles(rows.map((row) => row.owner_id)),
    supabase.from('collection_items').select('collection_id').in('collection_id', rows.map((row) => row.id)),
  ]);
  if (items.error) throw new Error(databaseMessage(items.error));
  return rows.map((row) => ({ ...row, profile: profiles.get(row.owner_id), items: (items.data ?? []).filter((item) => item.collection_id === row.id).length })) as Collection[];
}

export default function CommunityFeed({ userId, onSignIn, onOpenMovie }: { userId: string | null; onSignIn: () => void; onOpenMovie: (movie: Movie) => void }) {
  const [space, setSpace] = useState<Space>('Feed');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'opinion' | 'question' | 'discussion' | 'recommendation'>('opinion');
  const [notice, setNotice] = useState('');
  const [busyPost, setBusyPost] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const client = useQueryClient();
  const posts = useQuery({ queryKey: ['community-posts', space, userId], enabled: Boolean(supabase && (space === 'Feed' || space === 'Discussions')), queryFn: () => getPosts(space, userId) });
  const reviews = useQuery({ queryKey: ['community-reviews'], enabled: Boolean(supabase && space === 'Reviews'), queryFn: getReviews });
  const collections = useQuery({ queryKey: ['community-collections'], enabled: Boolean(supabase && space === 'Collections'), queryFn: getCollections });
  const trailers = useQuery({ queryKey: ['community-trailers'], enabled: space === 'Trailers', queryFn: getMovieTrailers });
  const releaseYear = new Date().getUTCFullYear();
  const news = useQuery({ queryKey: ['community-news', releaseYear], enabled: space === 'News', queryFn: ({ signal }) => getMovieSchedule('released', releaseYear, signal) });

  useEffect(() => {
    if (!supabase || (space !== 'Feed' && space !== 'Discussions')) return;
    const channel = supabase.channel('community-posts').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => void client.invalidateQueries({ queryKey: ['community-posts'] })).subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [client, space]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return onSignIn();
    if (!supabase || !body.trim() || busyPost) return;
    setBusyPost(true); setNotice('');
    const { error } = await supabase.from('posts').insert({ author_id: userId, kind, body: body.trim() });
    setBusyPost(false);
    if (error) return setNotice(databaseMessage(error));
    setBody('');
    setNotice('Posted');
    void client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function toggleLike(post: Post) {
    if (!userId || !supabase) return onSignIn();
    const result = post.liked
      ? await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', userId)
      : await supabase.from('post_reactions').upsert({ post_id: post.id, user_id: userId, reaction: 'love' }, { onConflict: 'post_id,user_id' });
    if (result.error) return setNotice(databaseMessage(result.error));
    void client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function toggleRepost(post: Post) {
    if (!userId || !supabase) return onSignIn();
    const result = post.reposted
      ? await supabase.from('post_reposts').delete().eq('post_id', post.id).eq('user_id', userId)
      : await supabase.from('post_reposts').insert({ post_id: post.id, user_id: userId });
    if (result.error) return setNotice(databaseMessage(result.error));
    void client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function toggleFollow(post: Post) {
    if (!userId || !supabase) return onSignIn();
    if (post.author_id === userId) return;
    const result = post.followed
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', post.author_id)
      : await supabase.from('follows').insert({ follower_id: userId, followed_id: post.author_id });
    if (result.error) return setNotice(databaseMessage(result.error));
    void client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function addComment(post: Post, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !supabase) return onSignIn();
    const form = event.currentTarget;
    const input = new FormData(form).get('comment')?.toString().trim();
    if (!input) return;
    const { error } = await supabase.from('comments').insert({ post_id: post.id, author_id: userId, body: input });
    if (error) return setNotice(databaseMessage(error));
    form.reset();
    void client.invalidateQueries({ queryKey: ['community-posts'] });
  }

  async function addReviewComment(review: Review, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !supabase) return onSignIn();
    const form = event.currentTarget;
    const text = new FormData(form).get('comment')?.toString().trim();
    if (!text) return;
    const { error } = await supabase.from('review_comments').insert({ review_id: review.id, author_id: userId, body: text });
    if (error) return setNotice(databaseMessage(error));
    form.reset();
    void client.invalidateQueries({ queryKey: ['community-reviews'] });
  }

  return <><section className="community-page">
    <div className="community-toolbar"><div className="community-page-heading"><span><Users size={15}/> COMMUNITY</span><h1>Find your film people.</h1></div></div>
    <div className="community-spaces" role="tablist" aria-label="Community spaces">{spaces.map(({ name, icon: Icon }) => <button type="button" role="tab" aria-selected={space === name} key={name} onClick={() => setSpace(name)}><Icon size={16}/><span>{name}</span></button>)}</div>
    {notice && <p className="community-state community-notice" role="status">{notice}</p>}
    {(space === 'Feed' || space === 'Discussions') && <div className="community-stream">
      <form className="community-composer" onSubmit={(event) => void publish(event)}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder="What movie is on your mind?" aria-label="Write a community post"/><div className="composer-controls"><label><span>Post as</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="opinion">Opinion</option><option value="discussion">Discussion</option><option value="question">Question</option><option value="recommendation">Recommendation</option></select></label><span className="composer-notice">{notice || 'Spoilers? Mark them in the movie discussion.'}</span><button disabled={!body.trim() || busyPost}><Send size={15}/> Post</button></div></form>
      {posts.isPending && <p className="community-state">Loading posts…</p>}
      {posts.isError && <div className="community-error-panel"><b>Posts couldn’t load.</b><span>{posts.error.message}</span><button type="button" onClick={() => void posts.refetch()}>Retry</button></div>}
      {!posts.isPending && !posts.isError && posts.data?.length === 0 && <div className="community-empty"><MessageCircle size={25}/><b>{space === 'Discussions' ? 'No discussions yet.' : 'Your feed starts here.'}</b><span>Start a conversation about a film.</span></div>}
      <div className="community-post-list">{posts.data?.map((post) => <article className="community-post" key={post.id}><button type="button" className="community-post-avatar" aria-label={`Open @${post.profile?.username ?? 'filmlover'} profile`} onClick={() => setSelectedProfile(post.author_id)}>{post.profile?.avatar_url ? <img src={post.profile.avatar_url} alt=""/> : (post.profile?.display_name ?? post.profile?.username ?? 'F').slice(0,1).toUpperCase()}</button><div className="community-post-body"><header><div><button className="profile-name-button" onClick={() => setSelectedProfile(post.author_id)}><b>{post.profile?.display_name ?? post.profile?.username ?? 'Film lover'}</b></button><span>@{post.profile?.username ?? 'filmlover'} · {new Date(post.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></div>{post.author_id !== userId && <button className="social-follow" type="button" aria-label={post.followed ? 'Unfollow person' : 'Follow person'} title={post.followed ? 'Unfollow' : 'Follow'} onClick={() => void toggleFollow(post)}>{post.followed ? 'Following' : 'Follow'}</button>}</header><span className="post-kind">{post.kind}</span><p>{post.body}</p><footer className="post-social-actions"><button type="button" className={post.liked ? 'is-liked' : ''} aria-label={post.liked ? 'Unlike post' : 'Like post'} onClick={() => void toggleLike(post)}><Heart size={16} fill={post.liked ? 'currentColor' : 'none'}/><span>{post.likes}</span></button><button type="button" aria-label="Show comments" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle size={16}/><span>{post.comments.length}</span></button><button type="button" className={post.reposted ? 'is-reposted' : ''} aria-label={post.reposted ? 'Undo repost' : 'Repost'} onClick={() => void toggleRepost(post)}><Repeat2 size={16}/><span>{post.reposts}</span></button></footer>{post.comments.slice(-2).map((comment) => <div className="inline-comment" key={comment.id}><b>{comment.profile?.display_name ?? comment.profile?.username ?? 'Film lover'}</b><span>{comment.body}</span></div>)}<form className="inline-comment-form" onSubmit={(event) => void addComment(post, event)}><input id={`comment-${post.id}`} name="comment" maxLength={2000} placeholder="Add a comment…" aria-label="Add a comment"/><button type="submit" aria-label="Send comment"><Send size={14}/></button></form></div></article>)}</div>
    </div>}
    {space === 'News' && <section className="community-space-panel"><div className="space-heading"><Newspaper size={19}/><div><h2>New releases</h2><p>TMDB release dates · {releaseYear}</p></div></div>{news.isError && <ErrorPanel message={news.error.message} retry={() => void news.refetch()}/>}{news.isPending && <p className="community-state">Loading release news…</p>}<div className="space-movie-grid">{news.data?.results.map((movie) => <button type="button" className="space-movie-card" key={movie.id} onClick={() => onOpenMovie(movie)}><img src={movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : ''} alt=""/><span><b>{movie.title}</b><small>{movie.release_date || 'Release date pending'}</small></span></button>)}</div>{!news.isPending && !news.isError && news.data?.results.length === 0 && <EmptySpace text="No released films found for this year yet."/>}</section>}
    {space === 'Trailers' && <section className="community-space-panel"><div className="space-heading"><Video size={19}/><div><h2>Trailers</h2><p>Official YouTube trailers for trending films</p></div></div>{trailers.isError && <ErrorPanel message={trailers.error.message} retry={() => void trailers.refetch()}/>}{trailers.isPending && <p className="community-state">Finding trailers…</p>}{!trailers.isPending && !trailers.isError && trailers.data?.length === 0 && <EmptySpace text="No official trailers were available from TMDB right now."/>}<div className="trailer-grid">{trailers.data?.map((trailer) => <a className="trailer-card" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noreferrer" key={trailer.id}><div className="trailer-thumb">{trailer.poster_path && <img src={`https://image.tmdb.org/t/p/w500${trailer.poster_path}`} alt=""/>}<span><Video size={23}/></span></div><div><b>{trailer.title}</b><small>{trailer.name} · {trailer.release_date?.slice(0,4)}</small></div></a>)}</div></section>}
    {space === 'Reviews' && <section className="community-space-panel"><div className="space-heading"><Star size={19}/><div><h2>Reviews</h2><p>Recent reviews from the community</p></div></div>{reviews.isError && <ErrorPanel message={reviews.error.message} retry={() => void reviews.refetch()}/>}{reviews.isPending && <p className="community-state">Loading reviews…</p>}{reviews.data?.map((review) => <article className="review-card" key={review.id}><div className="review-card-meta"><button className="profile-name-button" onClick={() => setSelectedProfile(review.author_id)}><b>{review.profile?.display_name ?? review.profile?.username ?? 'Film lover'}</b></button><span>{review.movie?.title ?? 'Movie'} · ★ {review.rating.toFixed(1)}</span></div>{review.title && <h3>{review.title}</h3>}<p>{review.body}</p>{review.comments.map((comment) => <div className="inline-comment" key={comment.id}><b>{comment.profile?.display_name ?? comment.profile?.username ?? 'Film lover'}</b><span>{comment.body}</span></div>)}<form className="inline-comment-form" onSubmit={(event) => void addReviewComment(review, event)}><input id={`review-reply-${review.id}`} name="comment" maxLength={2000} placeholder="Reply to this review…" aria-label="Reply to review"/><button type="submit" aria-label="Send review reply"><Send size={14}/></button></form></article>)}{!reviews.isPending && !reviews.isError && reviews.data?.length === 0 && <EmptySpace text="No reviews yet. Be the first to review a movie."/>}</section>}
    {space === 'Collections' && <section className="community-space-panel"><div className="space-heading"><Bookmark size={19}/><div><h2>Collections</h2><p>Public movie lists made by film lovers</p></div></div>{collections.isError && <ErrorPanel message={collections.error.message} retry={() => void collections.refetch()}/>}{collections.isPending && <p className="community-state">Loading collections…</p>}{collections.data?.map((collection) => <article className="collection-card" key={collection.id}><div className="collection-card-icon"><Clapperboard size={19}/></div><div><h3>{collection.title}</h3><p>{collection.description || 'A community movie collection.'}</p><span>By {collection.profile?.display_name ?? collection.profile?.username ?? 'Film lover'} · {collection.items} films</span></div></article>)}{!collections.isPending && !collections.isError && collections.data?.length === 0 && <EmptySpace text="Public collections will show up here."/>}</section>}
  </section>{selectedProfile && <ProfileDialog profileId={selectedProfile} userId={userId} onClose={() => setSelectedProfile(null)} onSignIn={onSignIn}/>}</>;
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div className="community-error-panel"><b>Couldn’t load this space.</b><span>{message}</span><button type="button" onClick={retry}>Retry</button></div>;
}

function EmptySpace({ text }: { text: string }) {
  return <div className="community-empty"><Sparkles size={23}/><b>{text}</b></div>;
}

function ProfileDialog({ profileId, userId, onClose, onSignIn }: { profileId: string; userId: string | null; onClose: () => void; onSignIn: () => void }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['public-profile', profileId, userId], queryFn: async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const [person, posts, followers, following, ownFollow] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id', profileId).single(),
      supabase.from('posts').select('id,kind,body,is_spoiler,created_at').eq('author_id', profileId).order('created_at', { ascending: false }).limit(30),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', profileId),
      supabase.from('follows').select('followed_id', { count: 'exact', head: true }).eq('follower_id', profileId),
      userId && userId !== profileId ? supabase.from('follows').select('followed_id').eq('follower_id', userId).eq('followed_id', profileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const error = person.error || posts.error || followers.error || following.error || ownFollow.error;
    if (error) throw new Error(databaseMessage(error));
    if (!person.data) throw new Error('This profile is private or unavailable.');
    return { person: person.data, posts: posts.data ?? [], followers: followers.count ?? 0, following: following.count ?? 0, isFollowing: Boolean(ownFollow.data) };
  } });
  async function toggleFollow() {
    if (!userId || !supabase) return onSignIn();
    if (!query.data) return;
    const result = query.data.isFollowing
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', profileId)
      : await supabase.from('follows').insert({ follower_id: userId, followed_id: profileId });
    if (result.error) return;
    void client.invalidateQueries({ queryKey: ['public-profile', profileId] });
  }
  return <div className="profile-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="profile-dialog" role="dialog" aria-modal="true" aria-label="Member profile"><button className="profile-close" aria-label="Close profile" onClick={onClose}>×</button>{query.isPending && <p>Loading profile…</p>}{query.isError && <p>{query.error.message}</p>}{query.data && <><header><div className="profile-avatar">{query.data.person.avatar_url ? <img src={query.data.person.avatar_url} alt=""/> : query.data.person.display_name.slice(0, 1).toUpperCase()}</div><div><h2>{query.data.person.display_name}</h2><span>@{query.data.person.username}</span><p>{query.data.person.bio || 'Movie lover, collecting stories.'}</p></div>{userId !== profileId && <button className="social-follow" onClick={() => void toggleFollow()}>{query.data.isFollowing ? 'Following' : 'Follow'}</button>}</header><div className="profile-counts"><span><b>{query.data.posts.length}</b> posts</span><span><b>{query.data.followers}</b> followers</span><span><b>{query.data.following}</b> following</span></div><h3>Posts</h3>{query.data.posts.map((post) => <article className="profile-post" key={post.id}><small>{post.kind} · {new Date(post.created_at).toLocaleDateString()}</small><p>{post.is_spoiler ? 'Spoiler-protected post' : post.body}</p></article>)}{!query.data.posts.length && <p>No public posts yet.</p>}</>}</section></div>;
}
