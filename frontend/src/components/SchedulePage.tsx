import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, Clock3, Megaphone, Popcorn } from 'lucide-react';
import { getMovieSchedule, type ScheduleBucket, type ScheduleMedia } from '../services/movies';
import type { Movie } from '../types/movie';

type SchedulePageProps = { onOpen: (movie: Movie) => void };
const sections: { id: ScheduleBucket; label: string; icon: typeof CalendarDays; hint: string }[] = [
  { id: 'released', label: 'Released', icon: Check, hint: 'Popular titles released this year' },
  { id: 'today', label: 'Today', icon: CalendarDays, hint: 'Titles dated for today in India' },
  { id: 'upcoming', label: 'Upcoming', icon: Clock3, hint: 'The next 90 days' },
  { id: 'announced', label: 'Announced', icon: Megaphone, hint: 'Release dates beyond the next 90 days' },
];
const mediaOptions: { id: ScheduleMedia; label: string }[] = [
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV series' },
  { id: 'anime', label: 'Anime' },
];

export default function SchedulePage({ onOpen }: SchedulePageProps) {
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date()));
  const [year, setYear] = useState(currentYear);
  const [bucket, setBucket] = useState<ScheduleBucket>('upcoming');
  const [media, setMedia] = useState<ScheduleMedia>('movie');
  const [page, setPage] = useState(1);
  const schedule = useQuery({
    queryKey: ['title-schedule', media, bucket, year, page],
    queryFn: ({ signal }) => getMovieSchedule(bucket, year, signal, page, media),
  });
  const selected = sections.find((section) => section.id === bucket)!;
  const selectedMedia = mediaOptions.find((option) => option.id === media)!;
  const titleCount = schedule.data?.total_results ?? 0;

  return <section className="schedule-page">
    <header className="schedule-heading">
      <div>
        <span className="schedule-eyebrow"><CalendarDays size={15}/> RELEASE CALENDAR</span>
        <h1>Movie schedule</h1>
        <p>Browse real release dates for films, series, and anime.</p>
      </div>
      <label className="schedule-year">Year<select value={year} onChange={(event) => { setYear(Number(event.target.value)); setPage(1); }}>
        {Array.from({ length: currentYear - 1999 + 6 }, (_, index) => currentYear + 5 - index).map((option) => <option value={option} key={option}>{option}</option>)}
      </select></label>
    </header>
    <div className="schedule-media-tabs" role="tablist" aria-orientation="horizontal" aria-label="Title type">
      {mediaOptions.map((option) => <button type="button" role="tab" aria-selected={media === option.id} key={option.id} onClick={() => { setMedia(option.id); setPage(1); }}>{option.label}</button>)}
    </div>
    <div className="schedule-tabs" role="tablist" aria-orientation="horizontal" aria-label="Release schedule">
      {sections.map(({ id, label, icon: Icon }) => <button type="button" role="tab" aria-selected={bucket === id} key={id} onClick={() => { setBucket(id); setPage(1); if (id === 'announced' && year === currentYear) { const announcedYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date(Date.now() + 91 * 86_400_000))); if (announcedYear > year) setYear(announcedYear); } }}><Icon size={17}/>{label}</button>)}
    </div>
    <div className="schedule-results-heading">
      <div><h2>{selected.label} {selectedMedia.label.toLowerCase()} in {year}</h2><span>{selected.hint} · real TMDB data · India-local dates</span></div>
      {schedule.data && <span className="schedule-result-count">{titleCount} {media === 'movie' ? 'films' : media === 'anime' ? 'anime series' : 'series'}</span>}
    </div>
    {schedule.isPending && <><p className="community-state" role="status" aria-live="polite">Loading release calendar…</p><div className="schedule-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="schedule-skeleton"/>)}</div></>}
    {schedule.isError && <div className="schedule-error"><b>Schedule unavailable</b><span>{schedule.error.message}</span><button type="button" onClick={() => void schedule.refetch()}>Try again</button></div>}
    {!schedule.isPending && !schedule.isError && schedule.data?.results.length === 0 && <div className="schedule-empty"><Popcorn size={25}/><b>No {selectedMedia.label.toLowerCase()} listed for this period yet.</b><span>{bucket === 'announced' ? 'TMDB only lists titles with a confirmed release date. Try another year as dates are announced.' : 'Try a different year or release category. New titles appear as TMDB receives date information.'}</span></div>}
    <div className="schedule-grid">{schedule.data?.results.map((title) => {
      const destination = title.media_type === 'tv' || media !== 'movie' ? `https://www.themoviedb.org/tv/${title.id}` : null;
      const card = <><span className="schedule-poster">{title.poster_path ? <img src={`https://image.tmdb.org/t/p/w342${title.poster_path}`} alt={`${title.title} poster`} loading="lazy"/> : <Popcorn size={22}/>}</span><span className="schedule-movie-title">{title.title}</span><span className="schedule-release-date">{title.release_date || 'Date not listed'}</span></>;
      return destination
        ? <a className="schedule-movie" href={destination} target="_blank" rel="noreferrer" key={title.id}>{card}</a>
        : <button className="schedule-movie" type="button" key={title.id} onClick={() => onOpen(title)}>{card}</button>;
    })}</div>
    {schedule.data && schedule.data.total_pages > 1 && <nav className="schedule-pagination" aria-label="Schedule pages">
      <button type="button" disabled={page <= 1 || schedule.isFetching} onClick={() => setPage((current) => current - 1)}>Previous</button>
      <span aria-live="polite" aria-atomic="true">Page {page} of {Math.min(schedule.data.total_pages, 500)}</span>
      <button type="button" disabled={page >= Math.min(schedule.data.total_pages, 500) || schedule.isFetching} onClick={() => setPage((current) => current + 1)}>Next</button>
    </nav>}
  </section>;
}
