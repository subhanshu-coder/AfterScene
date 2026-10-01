import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Heart, Layers3, UserPlus, UserRoundCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { page: 'Movie diary' | 'Your people'; userId: string | null; onSignIn: () => void };
type DiaryEntry = { id: string; watched_on: string; rating: number | null; note: string | null; movies: { title: string; poster_path: string | null; tmdb_id: number } | null };
type Person = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null };

export default function LibraryPage({ page, userId, onSignIn }: Props) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const diary = useQuery({ queryKey: ['movie-diary', userId], enabled: Boolean(userId && page === 'Movie diary' && supabase), queryFn: async () => {
    const { data, error: queryError } = await supabase!.from('watch_history').select('id,watched_on,rating,note,movies(title,poster_path,tmdb_id)').eq('user_id', userId!).order('watched_on', { ascending: false }).limit(100);
    if (queryError) throw new Error('Your movie diary could not load.');
    return (data ?? []) as unknown as DiaryEntry[];
  } });
  const people = useQuery({ queryKey: ['people-to-follow', userId], enabled: Boolean(userId && page === 'Your people' && supabase), queryFn: async () => {
    const [{ data: profiles, error: profileError }, { data: follows, error: followError }] = await Promise.all([
      supabase!.from('profiles').select('id,username,display_name,bio,avatar_url').neq('id', userId!).order('created_at', { ascending: false }).limit(30),
      supabase!.from('follows').select('followed_id').eq('follower_id', userId!),
    ]);
    if (profileError || followError) throw new Error('People recommendations could not load.');
    const following = new Set((follows ?? []).map((follow) => follow.followed_id));
    return { profiles: (profiles ?? []) as Person[], following };
  } });
  async function toggleFollow(person: Person) {
    if (!userId || !supabase) return onSignIn();
    setError('');
    const follows = people.data?.following.has(person.id) ?? false;
    const result = follows
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', person.id)
      : await supabase.from('follows').insert({ follower_id: userId, followed_id: person.id });
    if (result.error) return setError('Could not update your following list. Try again.');
    void client.invalidateQueries({ queryKey: ['people-to-follow', userId] });
  }

  return <section className="library-page">
    <div className="community-page-heading"><span>{page === 'Movie diary' ? <><Layers3 size={14}/> YOUR MOVIE JOURNEY</> : <><Heart size={14}/> FIND YOUR PEOPLE</>}</span><h1>{page === 'Movie diary' ? <>The stories you’ve<br/><i>lived through.</i></> : <>Good taste is<br/><i>better shared.</i></>}</h1><p>{page === 'Movie diary' ? 'Your watched films, ratings, and notes in one timeline.' : 'Meet other movie lovers and build your film circle.'}</p></div>
    {!userId && <div className="community-empty"><Bookmark size={25}/><b>Sign in to open your {page === 'Movie diary' ? 'movie diary' : 'people page'}.</b><button className="page-primary" onClick={onSignIn}>Sign in</button></div>}
    {userId && page === 'Movie diary' && <>{diary.isPending && <p className="community-state">Loading your diary…</p>}{diary.isError && <p className="community-state community-error">{diary.error.message}</p>}{diary.data?.length === 0 && <div className="community-empty"><Layers3 size={25}/><b>Your movie diary is waiting.</b><span>Mark a film as watched to start your timeline.</span></div>}<div className="diary-list">{diary.data?.map((entry) => <article key={entry.id} className="diary-entry">{entry.movies?.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${entry.movies.poster_path}`} alt=""/> : <span className="diary-poster"/>}<div><time>{new Date(`${entry.watched_on}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</time><b>{entry.movies?.title ?? 'Movie entry'}</b>{entry.rating && <span>{entry.rating} / 5 stars</span>}{entry.note && <p>{entry.note}</p>}</div></article>)}</div></>}
    {userId && page === 'Your people' && <>{people.isPending && <p className="community-state">Finding movie people…</p>}{people.isError && <p className="community-state community-error">{people.error.message}</p>}{error && <p className="community-state community-error">{error}</p>}{people.data?.profiles.length === 0 && <div className="community-empty"><Heart size={25}/><b>Your film circle starts here.</b><span>New community members will show up here.</span></div>}<div className="people-list">{people.data?.profiles.map((person) => <article className="person-card" key={person.id}><span className="person-avatar">{person.avatar_url ? <img src={person.avatar_url} alt=""/> : person.display_name.slice(0,1).toUpperCase()}</span><div><b>{person.display_name}</b><span>@{person.username}</span><p>{person.bio || 'Movie lover, still writing their story.'}</p></div><button onClick={() => void toggleFollow(person)}>{people.data?.following.has(person.id) ? <><UserRoundCheck size={14}/> Following</> : <><UserPlus size={14}/> Follow</>}</button></article>)}</div></>}
  </section>;
}
