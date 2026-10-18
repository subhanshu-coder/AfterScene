import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Film, Flame } from 'lucide-react';
import { discoverMovies } from '../services/movies';
import type { Movie } from '../types/movie';

export default function DiscoverPage({ onOpen, onSave }: { onOpen: (movie: Movie) => void; onSave: (movie: Movie) => void }) {
  const [page, setPage] = useState(1);
  const films = useQuery({ queryKey: ['movies', 'discover', page], queryFn: ({ signal }) => discoverMovies(signal, page), placeholderData: (previous) => previous });
  const pageCount = Math.min(films.data?.total_pages ?? 1, 500);
  return <section className="discover-page">
    <header className="discover-heading"><span><Flame size={15}/> THE MOVIE INDEX</span><h1>All films, one good rabbit hole.</h1><p>Explore TMDB’s paginated movie catalogue, ordered by current popularity.</p></header>
    {films.isPending && <div className="movie-grid">{Array.from({ length: 10 }, (_, index) => <div className="movie-skeleton" key={index}><div className="skeleton-poster"/><div className="skeleton-line"/><div className="skeleton-short"/></div>)}</div>}
    {films.isError && <div className="community-error-panel"><b>Movies couldn’t load.</b><span>{films.error.message}</span><button onClick={() => void films.refetch()}>Try again</button></div>}
    {films.data?.results.length === 0 && <div className="community-empty"><Film/><b>No films were returned.</b><span>Try refreshing the movie catalogue.</span></div>}
    {films.data?.results.length ? <div className="movie-grid">{films.data.results.map((movie) => <article className="movie-card" key={movie.id}><button className="poster-wrap" onClick={() => onOpen(movie)} aria-label={`Explore ${movie.title}`}><img className="poster-image" src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/app-icon.svg'} alt={`${movie.title} poster`} loading="lazy"/><span className="poster-rating">★ {movie.vote_average ? movie.vote_average.toFixed(1) : '—'}</span></button><div className="movie-info"><div><h3>{movie.title}</h3><span>{movie.release_date?.slice(0, 4) || '—'}</span></div><button className="save-button" onClick={() => onSave(movie)} aria-label={`Add ${movie.title} to watchlist`}>+</button></div></article>)}</div> : null}
    {films.data && pageCount > 1 && <nav className="discover-pagination" aria-label="Movie pages"><button disabled={page <= 1 || films.isFetching} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={16}/> Previous</button><span aria-live="polite" aria-atomic="true">Page {page} of {pageCount}</span><button disabled={page >= pageCount || films.isFetching} onClick={() => setPage((value) => value + 1)}>Next <ArrowRight size={16}/></button></nav>}
  </section>;
}

