import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Dna, Film, Globe2, Star, UserRound, CalendarRange } from 'lucide-react';
import { supabase } from '../lib/supabase';

type RawMovie = { id: string; title: string; genres: number[]; release_date: string | null; metadata: Record<string, unknown> | null };
type TasteMovie = Omit<RawMovie, 'metadata'> & { metadata: Record<string, unknown>; weight: number; rating: number | null };
const genreNames: Record<number, string> = { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-fi', 10770: 'TV film', 53: 'Thriller', 10752: 'War', 37: 'Western' };

async function getTasteData(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const [ratings, history, watchlist] = await Promise.all([
    supabase.from('movie_ratings').select('movie_id,rating').eq('user_id', userId),
    supabase.from('watch_history').select('movie_id,rating').eq('user_id', userId),
    supabase.from('watchlists').select('movie_id').eq('user_id', userId),
  ]);
  const failed = [ratings.error, history.error, watchlist.error].find(Boolean);
  if (failed) throw new Error('Your Movie DNA could not load. Check your profile data access in Supabase.');
  const allIds = [...new Set([...(ratings.data ?? []).map((entry) => entry.movie_id), ...(history.data ?? []).map((entry) => entry.movie_id), ...(watchlist.data ?? []).map((entry) => entry.movie_id)])];
  if (!allIds.length) return { movies: [] as TasteMovie[], average: null };
  const movies = await supabase.from('movies').select('id,title,genres,release_date,metadata').in('id', allIds);
  if (movies.error) throw new Error('Movie details for your taste profile could not load.');
  const ratingMap = new Map((ratings.data ?? []).map((entry) => [entry.movie_id, Number(entry.rating)]));
  const historyIds = new Set((history.data ?? []).map((entry) => entry.movie_id));
  const watchIds = new Set((watchlist.data ?? []).map((entry) => entry.movie_id));
  const tasteMovies = (movies.data ?? []).map((movie) => {
    const rating = ratingMap.get(movie.id) ?? (history.data ?? []).find((entry) => entry.movie_id === movie.id)?.rating ?? null;
    return { ...movie, genres: movie.genres ?? [], metadata: (movie.metadata ?? {}) as Record<string, unknown>, rating: rating === null ? null : Number(rating), weight: rating !== null ? 1 + Number(rating) / 5 : historyIds.has(movie.id) ? 0.7 : watchIds.has(movie.id) ? 0.3 : 0 };
  }).filter((movie) => movie.weight > 0) as TasteMovie[];
  const ratingValues = [...ratingMap.values()];
  return { movies: tasteMovies, average: ratingValues.length ? ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length : null };
}

function ranked(counts: Map<string, number>, limit = 5) {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, value]) => ({ label, share: total ? Math.round(value / total * 100) : 0 }));
}

export default function MovieDnaPage({ userId }: { userId: string | null }) {
  const query = useQuery({ queryKey: ['movie-dna', userId], enabled: Boolean(userId && supabase), queryFn: () => getTasteData(userId!) });
  const dna = useMemo(() => {
    const genreCounts = new Map<string, number>(), decades = new Map<string, number>(), languages = new Map<string, number>(), directors = new Map<string, number>(), actors = new Map<string, number>();
    for (const movie of query.data?.movies ?? []) {
      for (const genreId of movie.genres) {
        const name = genreNames[genreId] ?? 'Other';
        genreCounts.set(name, (genreCounts.get(name) ?? 0) + movie.weight);
      }
      const year = Number(movie.release_date?.slice(0,4));
      if (year) { const decade = `${Math.floor(year / 10) * 10}s`; decades.set(decade, (decades.get(decade) ?? 0) + movie.weight); }
      const language = String(movie.metadata.original_language ?? '').toUpperCase();
      if (language) languages.set(language, (languages.get(language) ?? 0) + movie.weight);
      const credits = movie.metadata.credits as { crew?: { job?: string; name?: string }[]; cast?: { name?: string }[] } | undefined;
      const director = credits?.crew?.find((person) => person.job === 'Director')?.name;
      if (director) directors.set(director, (directors.get(director) ?? 0) + movie.weight);
      for (const actor of credits?.cast?.slice(0,3) ?? []) if (actor.name) actors.set(actor.name, (actors.get(actor.name) ?? 0) + movie.weight);
    }
    return { genres: ranked(genreCounts), decades: ranked(decades,3), languages: ranked(languages,4), directors: ranked(directors,4), actors: ranked(actors,4) };
  }, [query.data]);

  return <section className="dna-page"><header className="dna-page-heading"><span><Dna size={16}/> YOUR MOVIE DNA</span><h1>Your taste,<br/><i>in focus.</i></h1><p>Built from the films you rate, watch, and save.</p></header>
    {query.isPending && <p className="community-state">Reading your movie history…</p>}
    {query.isError && <div className="community-error-panel"><b>Movie DNA couldn’t load.</b><span>{query.error.message}</span><button onClick={() => void query.refetch()}>Retry</button></div>}
    {!query.isPending && !query.isError && query.data?.movies.length === 0 && <div className="community-empty"><Film size={25}/><b>Your taste profile starts with your first film.</b><span>Rate a movie, mark it watched, or save it to your watchlist.</span></div>}
    {!!query.data?.movies.length && <><div className="dna-overview"><div><Film size={18}/><span><b>{query.data.movies.length}</b><small>films in your history</small></span></div><div><Star size={18}/><span><b>{query.data.average === null ? '—' : query.data.average.toFixed(1)}</b><small>average rating</small></span></div><div><CalendarRange size={18}/><span><b>{dna.decades[0]?.label ?? '—'}</b><small>favorite decade</small></span></div></div>
      <div className="dna-grid"><TraitCard title="Genres" icon={<Dna size={17}/>} items={dna.genres}/><TraitCard title="Decades" icon={<CalendarRange size={17}/>} items={dna.decades}/><TraitCard title="Languages" icon={<Globe2 size={17}/>} items={dna.languages}/><TraitCard title="Directors" icon={<UserRound size={17}/>} items={dna.directors}/><TraitCard title="Cast" icon={<UserRound size={17}/>} items={dna.actors}/></div>
      <p className="dna-method-note">Your mix updates as your logged films, ratings, and watchlist change.</p></>}
  </section>;
}

function TraitCard({ title, icon, items }: { title: string; icon: ReactNode; items: { label: string; share: number }[] }) {
  return <article className="dna-trait-card"><h2>{icon}{title}</h2>{items.length ? items.map((item) => <div className="dna-bar-row" key={item.label}><div><span>{item.label}</span><b>{item.share}%</b></div><span className="dna-bar"><i style={{ width: `${item.share}%` }}/></span></div>) : <p className="dna-no-data">Add more film history to reveal this.</p>}</article>;
}
