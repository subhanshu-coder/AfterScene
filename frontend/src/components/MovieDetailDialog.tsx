import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays, Check, Clapperboard, Clock3, Heart, LoaderCircle, MessageCircle, Star, X } from 'lucide-react';
import type { Movie } from '../types/movie';
import { getUserMovieState, removeWatchlist, saveMovieRating, saveWatchlist, setWatchlistStatus } from '../services/movieActions';
import { supabase } from '../lib/supabase';
import MovieDiscussion from './MovieDiscussion';

type MovieDetails = Movie & { runtime?: number; genres?: { id: number; name: string }[]; tagline?: string; production_companies?: { id: number; name: string }[]; credits?: { crew?: { id: number; name: string; job: string }[]; cast?: { id: number; name: string; character: string; profile_path: string | null }[] }; videos?: { results?: { id: string; name: string; key: string; site: string; type: string }[] } };
type ReviewEntry = { id: string; author_id: string; title: string | null; body: string; rating: number; created_at: string; author: { username: string; display_name: string; avatar_url: string | null } | null; comments: { id: string; author_id: string; body: string; created_at: string; profile: { username: string; display_name: string } | null }[] };
type Props = { movie: Movie; userName: string | null; userId: string | null; onClose: () => void; onSignIn: () => void; onToast: (message: string) => void; onOpenProfile: (id: string) => void };
const apiBase = import.meta.env.PROD ? '' : import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const posterBase = 'https://image.tmdb.org/t/p/w500';
const backdropBase = 'https://image.tmdb.org/t/p/w1280';

export default function MovieDetailDialog({ movie, userName, userId, onClose, onSignIn, onToast, onOpenProfile }: Props) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [watchStatus, setWatchStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState<'rating' | 'watchlist' | null>(null);
  const [actionError, setActionError] = useState('');
  const [verdict, setVerdict] = useState<string | null>(null);
  const [community, setCommunity] = useState<{ count: number; score: number | null; distribution: Record<string, number> } | null>(null);
  const details = useQuery({ queryKey: ['movie', movie.id], queryFn: async ({ signal }) => {
    const response = await fetch(`${apiBase}/api/movies/${movie.id}`, { signal });
    if (!response.ok) throw new Error('Movie details could not be loaded.');
    return response.json() as Promise<MovieDetails>;
  } });
  const reviews = useQuery({ queryKey: ['movie-reviews', movie.id], enabled: Boolean(supabase), queryFn: async () => {
    const { data: movieRow, error: movieError } = await supabase!.from('movies').select('id').eq('tmdb_id', movie.id).maybeSingle();
    if (movieError) throw new Error('Movie reviews could not be loaded.');
    if (!movieRow) return [] as ReviewEntry[];
    const { data, error } = await supabase!.from('reviews').select('id,author_id,title,body,rating,created_at').eq('movie_id', movieRow.id).order('created_at', { ascending: false }).limit(30);
    if (error) throw new Error('Movie reviews could not be loaded.');
    const rows = data ?? [];
    if (!rows.length) return [] as ReviewEntry[];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const [{ data: authors, error: authorError }, { data: comments, error: commentError }] = await Promise.all([
      supabase!.from('profiles').select('id,username,display_name,avatar_url').in('id', authorIds),
      supabase!.from('review_comments').select('id,review_id,author_id,body,created_at').in('review_id', rows.map((row) => row.id)).order('created_at', { ascending: true }),
    ]);
    if (authorError || commentError) throw new Error('Movie review discussion could not be loaded.');
    const commentRows = comments ?? [];
    const commentAuthors = [...new Set(commentRows.map((row) => row.author_id))];
    const { data: commentProfiles, error: commentProfilesError } = commentAuthors.length ? await supabase!.from('profiles').select('id,username,display_name').in('id', commentAuthors) : { data: [], error: null };
    if (commentProfilesError) throw new Error('Review replies could not be loaded.');
    const people = new Map((authors ?? []).map((person) => [person.id, person]));
    const replyPeople = new Map((commentProfiles ?? []).map((person) => [person.id, person]));
    return rows.map((row) => ({ ...row, author: people.get(row.author_id) ?? null, comments: commentRows.filter((comment) => comment.review_id === row.id).map((comment) => ({ ...comment, profile: replyPeople.get(comment.author_id) ?? null })) })) as ReviewEntry[];
  } });
  const reviewClient = useQueryClient();
  const personalState = useQuery({ queryKey: ['movie', movie.id, 'me'], queryFn: () => getUserMovieState(movie.id), enabled: Boolean(userName), retry: false });
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/api/movies/${movie.id}/community-score`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((result) => { if (result) setCommunity(result); }).catch(() => undefined);
    return () => controller.abort();
  }, [movie.id]);
  const data = details.data;
  const movieTitle = data?.title ?? movie.title;
  const director = data?.credits?.crew?.find((member) => member.job === 'Director')?.name;
  const trailer = data?.videos?.results?.find((video) => video.site === 'YouTube' && video.type === 'Trailer');
  const producers = data?.credits?.crew?.filter((member) => /^(producer|executive producer)$/i.test(member.job)).map((member) => member.name).filter((name, index, names) => names.indexOf(name) === index).slice(0, 4) ?? [];

  useEffect(() => {
    setMyRating(personalState.data?.rating ?? null);
    setWatchStatus(personalState.data?.watchlistStatus ?? null);
  }, [personalState.data]);

  async function replyToReview(reviewId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !supabase) return onSignIn();
    const form = event.currentTarget;
    const body = new FormData(form).get('reply')?.toString().trim();
    if (!body) return;
    const { error } = await supabase.from('review_comments').insert({ review_id: reviewId, author_id: userId, body });
    if (error) return setActionError('Could not send your review reply. Please try again.');
    form.reset();
    void reviewClient.invalidateQueries({ queryKey: ['movie-reviews', movie.id] });
  }

  async function rate(rating: number) {
    if (!userName) return onSignIn();
    setSaving('rating'); setActionError('');
    try {
      await saveMovieRating(movie.id, rating);
      setMyRating(rating);
      onToast('Your rating is saved.');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Your rating could not be saved.'); }
    finally { setSaving(null); }
  }

  async function toggleWatchlist() {
    if (!userName) return onSignIn();
    setSaving('watchlist'); setActionError('');
    try {
      if (watchStatus && watchStatus !== 'watched') {
        await removeWatchlist(movie.id);
        setWatchStatus(null);
        onToast('Removed from your watchlist.');
      } else {
        await saveWatchlist(movie.id);
        setWatchStatus('want_to_watch');
        onToast('Added to your watchlist.');
      }
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Your watchlist could not be updated.'); }
    finally { setSaving(null); }
  }

  async function submitVerdict(value: 'skip' | 'time_pass' | 'good' | 'love') {
    if (!userName) return onSignIn();
    if (!supabase) return setActionError('Supabase is not configured.');
    setSaving('rating'); setActionError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return onSignIn();
      const response = await fetch(`${apiBase}/api/movies/${movie.id}/verdict`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ verdict: value }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Your verdict could not be saved.');
      setVerdict(value);
      const scoreResponse = await fetch(`${apiBase}/api/movies/${movie.id}/community-score`);
      if (scoreResponse.ok) setCommunity(await scoreResponse.json());
      onToast('Your AfterScore vote is in.');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Your verdict could not be saved.'); }
    finally { setSaving(null); }
  }

  async function markWatched() {
    if (!userName) return onSignIn();
    setSaving('watchlist'); setActionError('');
    try {
      await setWatchlistStatus(movie.id, 'watched');
      setWatchStatus('watched');
      onToast('Marked watched and added to your movie diary.');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'This movie could not be added to your diary.'); }
    finally { setSaving(null); }
  }

  return <div className="movie-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="movie-dialog" role="dialog" aria-modal="true" aria-labelledby="movie-dialog-title">
      <button className="movie-dialog-close" onClick={onClose} aria-label="Close movie details"><X size={19}/></button>
      <div className="movie-dialog-backdrop-image" style={{ backgroundImage: data?.backdrop_path ? `linear-gradient(90deg,#151612 3%,rgba(21,22,18,.82) 49%,rgba(21,22,18,.3)),linear-gradient(0deg,#151612,transparent 54%),url(${backdropBase}${data.backdrop_path})` : undefined }}/>
      <div className="movie-dialog-main">
        <div className="movie-dialog-poster">{(data?.poster_path ?? movie.poster_path) ? <img src={`${posterBase}${data?.poster_path ?? movie.poster_path}`} alt={`${movieTitle} poster`}/> : <Clapperboard size={30}/>}</div>
        <div className="movie-dialog-copy">
          <span className="movie-dialog-eyebrow"><Clapperboard size={12}/> THE MOVIE FILE</span>
          <h2 id="movie-dialog-title">{movieTitle}<span>.</span></h2>
          {data?.tagline && <p className="movie-tagline">“{data.tagline}”</p>}
          <div className="movie-facts"><span><CalendarDays size={13}/>{data?.release_date?.slice(0,4) ?? movie.release_date?.slice(0,4) ?? '—'}</span>{data?.runtime ? <span><Clock3 size={13}/>{Math.floor(data.runtime / 60)}h {data.runtime % 60}m</span> : null}<span><Star size={13} fill="currentColor"/>{data?.vote_average?.toFixed(1) ?? movie.vote_average?.toFixed(1) ?? '—'} TMDB</span></div>
          <div className="movie-genres">{data?.genres?.slice(0,4).map((genre) => <span key={genre.id}>{genre.name}</span>)}</div>
          <p className="movie-overview">{data?.overview ?? movie.overview ?? (details.isPending ? 'Loading film details…' : '')}</p>
          {director && <p className="movie-director">DIRECTED BY <b>{director}</b></p>}{producers.length > 0 && <p className="movie-director">PRODUCED BY <b>{producers.join(' · ')}</b></p>}{data?.production_companies?.length ? <p className="movie-director">PRODUCTION <b>{data.production_companies.slice(0, 3).map((company) => company.name).join(' · ')}</b></p> : null}
          <div className="movie-actions"><button className={`watchlist-action ${watchStatus && watchStatus !== 'watched' ? 'watchlist-saved' : ''}`} onClick={() => void toggleWatchlist()} disabled={saving !== null}>{saving === 'watchlist' ? <LoaderCircle className="spinning" size={15}/> : watchStatus && watchStatus !== 'watched' ? <Check size={15}/> : <Heart size={15}/>} {watchStatus && watchStatus !== 'watched' ? 'In your watchlist' : 'Add to watchlist'}</button><button className={`watchlist-action ${watchStatus === 'watched' ? 'watchlist-saved' : ''}`} onClick={() => void markWatched()} disabled={saving !== null}>{watchStatus === 'watched' ? <Check size={15}/> : <Clapperboard size={15}/>} {watchStatus === 'watched' ? 'Watched · in diary' : 'Mark watched'}</button>{trailer && <a className="trailer-action" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noreferrer">Watch trailer <ArrowUpRight size={14}/></a>}</div>
          <div className="your-rating"><span>YOUR RATING</span><div role="group" aria-label="Rate this movie">{[1,2,3,4,5].map((rating) => <button key={rating} className={myRating !== null && rating <= myRating ? 'rated-star' : ''} onClick={() => void rate(rating)} disabled={saving !== null} aria-label={`${rating} out of 5 stars`} aria-pressed={myRating === rating}><Star size={19} fill={myRating !== null && rating <= myRating ? 'currentColor' : 'none'}/></button>)}</div>{saving === 'rating' && <LoaderCircle size={13} className="spinning"/>}<small>{myRating ? `${myRating} / 5` : 'Rate after watching'}</small></div>
          <section className="afterscene-score"><div className="score-heading"><div><span>AFTERSCENE SCORE</span><b>{community?.score === null || community?.score === undefined ? '—' : `${community.score}%`}</b></div><small>{community?.count ?? 0} fan {community?.count === 1 ? 'vote' : 'votes'}</small></div><p>How did it feel to watch?</p><div className="verdict-buttons">{([{id:'skip',label:'Skip it',symbol:'↷'},{id:'time_pass',label:'Time-pass',symbol:'◷'},{id:'good',label:'Good movie',symbol:'✦'},{id:'love',label:'Loved it',symbol:'♥'}] as const).map((item) => <button key={item.id} className={verdict === item.id ? 'verdict-selected' : ''} onClick={() => void submitVerdict(item.id)} disabled={saving !== null} aria-pressed={verdict === item.id}><span>{item.symbol}</span>{item.label}<small>{community?.distribution[item.id] ?? 0}</small></button>)}</div><small className="score-note">Score reflects real community votes from Skip to Loved it.</small></section>
          {personalState.isError && userName && <p className="movie-action-error">{personalState.error.message}</p>}
          {actionError && <p className="movie-action-error" role="alert">{actionError}</p>}
          {details.isError && <p className="movie-action-error">Movie details could not be loaded. You can still save a rating if the API is available.</p>}
        </div>
      </div>
      <div className="movie-dialog-cast">{data?.credits?.cast?.slice(0,5).map((person) => <div key={person.id} className="cast-person">{person.profile_path ? <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt="" loading="lazy" decoding="async"/> : <span className="cast-placeholder">{person.name.slice(0,1)}</span>}<span><b>{person.name}</b><small>{person.character}</small></span></div>)}</div>
      <section className="movie-detail-reviews"><div className="movie-section-heading"><div><span>COMMUNITY</span><h3>Reviews</h3></div><small>{reviews.data?.length ?? 0} reviews</small></div>{reviews.isPending && <p aria-live="polite">Loading reviews…</p>}{reviews.isError && <p className="movie-action-error">{reviews.error.message}</p>}{reviews.data?.map((review) => <article className="movie-review" key={review.id}><header><button type="button" onClick={() => onOpenProfile(review.author_id)}><span className="review-avatar">{review.author?.avatar_url ? <img src={review.author.avatar_url} alt=""/> : (review.author?.display_name ?? 'F').slice(0, 1).toUpperCase()}</span><span><b>{review.author?.display_name ?? 'Film lover'}</b><small>@{review.author?.username ?? 'filmlover'}</small></span></button><span className="review-rating">★ {Number(review.rating).toFixed(1)}</span><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></header>{review.title && <h4>{review.title}</h4>}<p>{review.body}</p>{review.comments.map((comment) => <div className="movie-review-reply" key={comment.id}><button onClick={() => onOpenProfile(comment.author_id)}>{comment.profile?.display_name ?? comment.profile?.username ?? 'Film lover'}</button><span>{comment.body}</span><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></div>)}<form className="movie-review-reply-form" onSubmit={(event) => void replyToReview(review.id, event)}><input name="reply" maxLength={2000} placeholder="Reply to this review…" aria-label="Reply to review"/><button type="submit" aria-label="Send reply"><MessageCircle size={15}/></button></form></article>)}{!reviews.isPending && !reviews.isError && !reviews.data?.length && <p className="movie-reviews-empty">No community reviews yet. Start one from the Reviews section.</p>}</section>
      <MovieDiscussion tmdbId={movie.id} userId={userId} onSignIn={onSignIn}/>
      <div className="movie-dialog-credit">Movie data and images provided by TMDB. Afterscene is not endorsed or certified by TMDB.</div>
    </article>
  </div>;
}
