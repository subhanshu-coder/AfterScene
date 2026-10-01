import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Radio } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { tmdbId: number; userId: string | null; onSignIn: () => void };
type Message = { id: string; user_id: string; body: string; is_spoiler: boolean; created_at: string; profiles: { username: string; display_name: string } | null };

export default function MovieDiscussion({ tmdbId, userId, onSignIn }: Props) {
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const messages = useQuery({
    queryKey: ['movie-discussion', tmdbId],
    enabled: Boolean(supabase),
    queryFn: async () => {
      const { data, error: queryError } = await supabase!.from('movie_discussion_messages')
        .select('id,user_id,body,is_spoiler,created_at,profiles(username,display_name)')
        .eq('tmdb_id', tmdbId).order('created_at', { ascending: false }).limit(50);
      if (queryError) throw new Error('Discussion could not load. Apply the latest Supabase migration and try again.');
      return (data ?? []) as unknown as Message[];
    },
  });

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`movie-discussion-${tmdbId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movie_discussion_messages', filter: `tmdb_id=eq.${tmdbId}` }, () => {
        void client.invalidateQueries({ queryKey: ['movie-discussion', tmdbId] });
      }).subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [client, tmdbId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return onSignIn();
    if (!supabase || !body.trim()) return;
    setError('');
    const { error: insertError } = await supabase.from('movie_discussion_messages').insert({ tmdb_id: tmdbId, user_id: userId, body: body.trim(), is_spoiler: spoiler });
    if (insertError) return setError('Could not send your message. Check that the latest database migration is applied.');
    setBody(''); setSpoiler(false);
    void client.invalidateQueries({ queryKey: ['movie-discussion', tmdbId] });
  }

  return <section className="movie-community-room" aria-label="Live movie discussion">
    <header><span className="room-icon"><MessageCircle size={15}/></span><div><b>Talk about this movie</b><small>Live fan discussion · Spoilers marked</small></div><span className="room-live"><Radio size={12}/> LIVE</span></header>
    <form onSubmit={(event) => void send(event)} className="room-compose"><input value={body} onChange={(event) => setBody(event.target.value)} maxLength={1200} placeholder={userId ? 'What did you think of it?' : 'Sign in to join the conversation'} aria-label="Your discussion message"/><label><input type="checkbox" checked={spoiler} onChange={(event) => setSpoiler(event.target.checked)}/> Spoiler</label><button aria-label="Send message" disabled={!body.trim()}><Send size={15}/></button></form>
    {error && <p className="room-error" role="alert">{error}</p>}
    {messages.isError && <p className="room-error" role="status">{messages.error.message}</p>}
    <div className="room-messages" aria-live="polite">
      {(messages.data ?? []).length === 0 && !messages.isPending && <p className="room-empty">No one’s started the conversation yet. Be the first.</p>}
      {(messages.data ?? []).map((message) => <article key={message.id} className="room-message"><span className="room-avatar">{(message.profiles?.display_name ?? message.profiles?.username ?? 'F').slice(0, 1).toUpperCase()}</span><div><div className="room-message-meta"><b>{message.profiles?.display_name ?? message.profiles?.username ?? 'Film lover'}</b><time>{new Date(message.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</time></div>{message.is_spoiler && !revealed.includes(message.id) ? <button className="spoiler-reveal" onClick={() => setRevealed((items) => [...items, message.id])}>Spoiler · tap to reveal</button> : <p>{message.body}</p>}</div></article>)}
    </div>
  </section>;
}
