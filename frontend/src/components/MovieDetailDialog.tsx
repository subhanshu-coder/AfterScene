import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays, Check, Clapperboard, Clock3, Heart, LoaderCircle, Star, X } from 'lucide-react';
import type { Movie } from '../types/movie';
import { getUserMovieState, removeWatchlist, saveMovieRating, saveWatchlist } from '../services/movieActions';

type MovieDetails = Movie & { runtime?: number; genres?: { id: number; name: string }[]; tagline?: string; credits?: { crew?: { id: number; name: string; job: string }[]; cast?: { id: number; name: string; character: string; profile_path: string | null }[] }; videos?: { results?: { id: string; name: string; key: string; site: string; type: string }[] } };
type Props = { movie: Movie; userName: string | null; onClose: () => void; onSignIn: () => void; onToast: (message: string) => void };
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const posterBase = 'https://image.tmdb.org/t/p/w500';
const backdropBase = 'https://image.tmdb.org/t/p/w1280';

export default function MovieDetailDialog({ movie, userName, onClose, onSignIn, onToast }: Props) {
  const [myRating, setMyRating] = useState<number | null>(null);
  const [watchStatus, setWatchStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState<'rating' | 'watchlist' | null>(null);
  const [actionError, setActionError] = useState('');
  const details = useQuery({ queryKey: ['movie', movie.id], queryFn: async ({ signal }) => {
    const response = await fetch(`${apiBase}/api/movies/${movie.id}`, { signal });
    if (!response.ok) throw new Error('Movie details could not be loaded.');
    return response.json() as Promise<MovieDetails>;
  } });
  const personalState = useQuery({ queryKey: ['movie', movie.id, 'me'], queryFn: () => getUserMovieState(movie.id), enabled: Boolean(userName), retry: false });
  const data = details.data;
  const movieTitle = data?.title ?? movie.title;
  const director = data?.credits?.crew?.find((member) => member.job === 'Director')?.name;
  const trailer = data?.videos?.results?.find((video) => video.site === 'YouTube' && video.type === 'Trailer');

  useEffect(() => {
    setMyRating(personalState.data?.rating ?? null);
    setWatchStatus(personalState.data?.watchlistStatus ?? null);
  }, [personalState.data]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
      if (watchStatus) {
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
          {director && <p className="movie-director">DIRECTED BY <b>{director}</b></p>}
          <div className="movie-actions"><button className={`watchlist-action ${watchStatus ? 'watchlist-saved' : ''}`} onClick={() => void toggleWatchlist()} disabled={saving !== null}>{saving === 'watchlist' ? <LoaderCircle className="spinning" size={15}/> : watchStatus ? <Check size={15}/> : <Heart size={15}/>} {watchStatus ? 'In your watchlist' : 'Add to watchlist'}</button>{trailer && <a className="trailer-action" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noreferrer">Watch trailer <ArrowUpRight size={14}/></a>}</div>
          <div className="your-rating"><span>YOUR RATING</span><div role="group" aria-label="Rate this movie">{[1,2,3,4,5].map((rating) => <button key={rating} className={myRating !== null && rating <= myRating ? 'rated-star' : ''} onClick={() => void rate(rating)} disabled={saving !== null} aria-label={`${rating} out of 5 stars`}><Star size={19} fill={myRating !== null && rating <= myRating ? 'currentColor' : 'none'}/></button>)}</div>{saving === 'rating' && <LoaderCircle size={13} className="spinning"/>}<small>{myRating ? `${myRating} / 5` : 'Rate after watching'}</small></div>
          {personalState.isError && userName && <p className="movie-action-error">{personalState.error.message}</p>}
          {actionError && <p className="movie-action-error" role="alert">{actionError}</p>}
          {details.isError && <p className="movie-action-error">Movie details could not be loaded. You can still save a rating if the API is available.</p>}
        </div>
      </div>
      <div className="movie-dialog-cast">{data?.credits?.cast?.slice(0,5).map((person) => <div key={person.id} className="cast-person">{person.profile_path ? <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt=""/> : <span className="cast-placeholder">{person.name.slice(0,1)}</span>}<span><b>{person.name}</b><small>{person.character}</small></span></div>)}</div>
      <div className="movie-dialog-credit">Movie data and images provided by TMDB. Afterscene is not endorsed or certified by TMDB.</div>
    </article>
  </div>;
}
