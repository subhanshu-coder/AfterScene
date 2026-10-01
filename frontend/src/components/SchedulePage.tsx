import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, Clock3, Megaphone, Popcorn } from 'lucide-react';
import { getMovieSchedule, type ScheduleBucket } from '../services/movies';
import type { Movie } from '../types/movie';

type SchedulePageProps = { onOpen: (movie: Movie) => void };
const sections: { id: ScheduleBucket; label: string; icon: typeof CalendarDays; hint: string }[] = [
  { id: 'released', label: 'Released', icon: Check, hint: 'Films released this year' },
  { id: 'today', label: 'Today', icon: CalendarDays, hint: 'Films dated for today' },
  { id: 'upcoming', label: 'Upcoming', icon: Clock3, hint: 'The next 90 days' },
  { id: 'announced', label: 'Announced', icon: Megaphone, hint: 'Later dated releases' },
];

export default function SchedulePage({ onOpen }: SchedulePageProps) {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [bucket, setBucket] = useState<ScheduleBucket>('upcoming');
  const schedule = useQuery({ queryKey: ['movie-schedule', bucket, year], queryFn: ({ signal }) => getMovieSchedule(bucket, year, signal) });
  const selected = sections.find((section) => section.id === bucket)!;

  return <section className="schedule-page">
    <header className="schedule-heading"><div><span className="schedule-eyebrow"><CalendarDays size={15}/> RELEASE CALENDAR</span><h1>Movie schedule</h1><p>Find what’s in theaters, today, and on the way.</p></div><label className="schedule-year">Year<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: currentYear - 1999 + 6 }, (_, index) => currentYear + 5 - index).map((option) => <option value={option} key={option}>{option}</option>)}</select></label></header>
    <div className="schedule-tabs" role="tablist" aria-label="Release schedule">{sections.map(({ id, label, icon: Icon }) => <button type="button" role="tab" aria-selected={bucket === id} key={id} onClick={() => setBucket(id)}><Icon size={17}/>{label}</button>)}</div>
    <div className="schedule-results-heading"><div><h2>{selected.label} in {year}</h2><span>{selected.hint} · data from TMDB</span></div>{schedule.data && <span className="schedule-result-count">{schedule.data.total_results} films</span>}</div>
    {schedule.isPending && <div className="schedule-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="schedule-skeleton"/>)}</div>}
    {schedule.isError && <div className="schedule-error"><b>Schedule unavailable</b><span>{schedule.error.message}</span><button type="button" onClick={() => void schedule.refetch()}>Try again</button></div>}
    {!schedule.isPending && !schedule.isError && schedule.data?.results.length === 0 && <div className="schedule-empty"><Popcorn size={25}/><b>No releases in this section yet.</b><span>Try another year or release category.</span></div>}
    <div className="schedule-grid">{schedule.data?.results.map((movie) => <button className="schedule-movie" type="button" key={movie.id} onClick={() => onOpen(movie)}><span className="schedule-poster">{movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} alt={`${movie.title} poster`} loading="lazy"/> : <Popcorn size={22}/>}</span><span className="schedule-movie-title">{movie.title}</span><span className="schedule-release-date">{movie.release_date || 'Date not listed'}</span></button>)}</div>
  </section>;
}
