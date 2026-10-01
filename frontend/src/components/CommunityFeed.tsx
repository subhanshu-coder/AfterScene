import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Post = { id: string; author_id: string; kind: string; body: string; is_spoiler: boolean; created_at: string; profiles: { username: string; display_name: string } | null };
export default function CommunityFeed({ userId, onSignIn }: { userId: string | null; onSignIn: () => void }) {
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  const feed = useQuery({ queryKey: ['community-feed'], enabled: Boolean(supabase), queryFn: async () => {
    const { data, error } = await supabase!.from('posts').select('id,author_id,kind,body,is_spoiler,created_at,profiles(username,display_name)').order('created_at', { ascending: false }).limit(30);
    if (error) throw new Error('Community posts could not load. Check your Supabase connection.');
    return (data ?? []) as unknown as Post[];
  } });
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('community-posts').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => void client.invalidateQueries({ queryKey: ['community-feed'] })).subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [client]);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return onSignIn();
    if (!supabase || !body.trim()) return;
    const { error } = await supabase.from('posts').insert({ author_id: userId, kind: 'opinion', body: body.trim() });
    if (error) return setNotice('Your post could not be published. Try again in a moment.');
    setBody(''); setNotice('Your post is live.');
    void client.invalidateQueries({ queryKey: ['community-feed'] });
  }
  return <section className="community-page">
    <div className="community-page-heading"><span><Users size={14}/> FILM PEOPLE, IN REAL TIME</span><h1>The conversation<br/><i>after the credits.</i></h1><p>Talk movies with people who love them as much as you do.</p></div>
    <form className="community-composer" onSubmit={(event) => void publish(event)}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder={userId ? 'What movie is on your mind?' : 'Sign in to share your take'} aria-label="Write a community post"/><div><span>{notice || 'Keep it kind. Mark spoilers in movie rooms.'}</span><button disabled={!body.trim()}><Send size={14}/> Post</button></div></form>
    {feed.isPending && <p className="community-state">Loading conversations…</p>}
    {feed.isError && <p className="community-state community-error">{feed.error.message}</p>}
    {!feed.isPending && !feed.isError && feed.data?.length === 0 && <div className="community-empty"><MessageCircle size={25}/><b>Start the first conversation.</b><span>Your movie community is ready when you are.</span></div>}
    <div className="community-post-list">{feed.data?.map((post) => <article className="community-post" key={post.id}><div className="community-post-avatar">{(post.profiles?.display_name ?? post.profiles?.username ?? 'F').slice(0,1).toUpperCase()}</div><div className="community-post-body"><header><b>{post.profiles?.display_name ?? post.profiles?.username ?? 'Film lover'}</b><span>@{post.profiles?.username ?? 'filmlover'} · {new Date(post.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></header><p>{post.body}</p><footer><span>{post.kind}</span><span><MessageCircle size={13}/> Movie room chat is available from a film page</span></footer></div></article>)}</div>
  </section>;
}
