import { env } from '../config/env.js';

export type ScheduleBucket = 'released' | 'today' | 'upcoming' | 'announced';
type Movie = { id: number; title: string; overview: string; poster_path: string | null; backdrop_path: string | null; release_date: string; vote_average: number; genre_ids: number[] };
type ScheduleResponse = { results: Movie[]; page: number; total_pages: number; total_results: number };
const cache = new Map<string, { expires: number; response: ScheduleResponse }>();
const cacheTtl = 10 * 60_000;

const dateString = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

export async function getMovieSchedule(bucket: ScheduleBucket, year: number): Promise<ScheduleResponse> {
  if (!env.TMDB_API_KEY) throw Object.assign(new Error('Movie schedule is not configured. Add TMDB_API_KEY to the backend environment.'), { statusCode: 503 });
  const today = new Date();
  const now = dateString(today);
  const currentYear = today.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  let from = yearStart;
  let to = yearEnd;

  if (bucket === 'today') {
    if (year !== currentYear) return { results: [], page: 1, total_pages: 0, total_results: 0 };
    from = now;
    to = now;
  } else if (bucket === 'released') {
    if (year > currentYear) return { results: [], page: 1, total_pages: 0, total_results: 0 };
    to = year === currentYear && now < yearEnd ? now : yearEnd;
  } else if (bucket === 'upcoming') {
    from = yearStart > now ? yearStart : now;
    const ninetyDays = dateString(addDays(today, 90));
    to = yearEnd < ninetyDays ? yearEnd : ninetyDays;
  } else {
    const announcedFrom = dateString(addDays(today, 91));
    from = yearStart > announcedFrom ? yearStart : announcedFrom;
  }

  if (from > to) return { results: [], page: 1, total_pages: 0, total_results: 0 };
  const cacheKey = `${bucket}:${year}:${from}:${to}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.response;

  const url = new URL(`${env.TMDB_BASE_URL}/discover/movie`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('region', 'US');
  url.searchParams.set('primary_release_date.gte', from);
  url.searchParams.set('primary_release_date.lte', to);
  url.searchParams.set('sort_by', bucket === 'released' ? 'popularity.desc' : 'primary_release_date.asc');
  url.searchParams.set('page', '1');

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw Object.assign(new Error('Could not reach TMDB. Try the schedule again shortly.'), { statusCode: 502 });
  }
  if (!response.ok) {
    const statusCode = response.status === 401 || response.status === 429 ? 503 : 502;
    const message = response.status === 401 ? 'TMDB rejected the configured API key.' : response.status === 429 ? 'TMDB is temporarily rate-limiting requests.' : 'The movie schedule could not be loaded from TMDB.';
    throw Object.assign(new Error(message), { statusCode });
  }
  const result = await response.json() as ScheduleResponse;
  cache.set(cacheKey, { expires: Date.now() + cacheTtl, response: result });
  if (cache.size > 100) {
    const nowMs = Date.now();
    for (const [key, item] of cache) if (item.expires <= nowMs) cache.delete(key);
    while (cache.size > 80) cache.delete(cache.keys().next().value!);
  }
  return result;
}
