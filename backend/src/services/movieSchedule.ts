import { env } from '../config/env.js';

export type ScheduleBucket = 'released' | 'today' | 'upcoming' | 'announced';
export type ScheduleMedia = 'movie' | 'tv' | 'anime';
type ScheduleTitle = { id: number; title: string; overview: string; poster_path: string | null; backdrop_path: string | null; release_date: string; vote_average: number; genre_ids: number[]; media_type: 'movie' | 'tv' };
type ScheduleResponse = { results: ScheduleTitle[]; page: number; total_pages: number; total_results: number };
const cache = new Map<string, { expires: number; response: ScheduleResponse }>();
const cacheTtl = 10 * 60_000;
const dayMs = 86_400_000;

function indiaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
const emptyResponse = (): ScheduleResponse => ({ results: [], page: 1, total_pages: 0, total_results: 0 });

export async function getMovieSchedule(bucket: ScheduleBucket, year: number, page = 1, media: ScheduleMedia = 'movie'): Promise<ScheduleResponse> {
  if (!env.TMDB_API_KEY) throw Object.assign(new Error('Movie schedule is not configured. Add TMDB_API_KEY to the backend environment.'), { statusCode: 503 });
  const now = indiaDate();
  const currentYear = Number(now.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  let from = yearStart;
  let to = yearEnd;

  if (bucket === 'today') {
    if (year !== currentYear) return emptyResponse();
    from = now;
    to = now;
  } else if (bucket === 'released') {
    if (year > currentYear) return emptyResponse();
    to = year === currentYear ? now : yearEnd;
  } else if (bucket === 'upcoming') {
    from = yearStart > now ? yearStart : now;
    const ninetyDays = addDays(now, 90);
    to = yearEnd < ninetyDays ? yearEnd : ninetyDays;
  } else {
    const announcedFrom = addDays(now, 91);
    from = yearStart > announcedFrom ? yearStart : announcedFrom;
  }

  if (from > to) return emptyResponse();
  const cacheKey = `${media}:${bucket}:${year}:${from}:${to}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.response;

  const isTv = media !== 'movie';
  const dateField = isTv ? 'first_air_date' : 'primary_release_date';
  const endpoint = isTv ? '/discover/tv' : '/discover/movie';
  const url = new URL(`${env.TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set(`${dateField}.gte`, from);
  url.searchParams.set(`${dateField}.lte`, to);
  url.searchParams.set('sort_by', 'popularity.desc');
  url.searchParams.set('page', String(page));
  if (media === 'movie' && bucket !== 'announced') url.searchParams.set('region', 'IN');
  if (media === 'anime') {
    url.searchParams.set('with_genres', '16');
    url.searchParams.set('with_original_language', 'ja');
  }

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw Object.assign(new Error('Could not reach TMDB. Try the schedule again shortly.'), { statusCode: 502 });
  }
  if (!response.ok) {
    const statusCode = response.status === 401 || response.status === 429 ? 503 : 502;
    const message = response.status === 401 ? 'TMDB rejected the configured API key.' : response.status === 429 ? 'TMDB is temporarily rate-limiting requests.' : 'The release schedule could not be loaded from TMDB.';
    throw Object.assign(new Error(message), { statusCode });
  }

  let body: { results?: (Record<string, unknown> & { id: number; title?: string; name?: string; overview?: string; poster_path?: string | null; backdrop_path?: string | null; release_date?: string; first_air_date?: string; vote_average?: number; genre_ids?: number[] })[]; page?: number; total_pages?: number; total_results?: number };
  try {
    body = await response.json() as typeof body;
  } catch {
    throw Object.assign(new Error('TMDB returned an unreadable release schedule. Try again shortly.'), { statusCode: 502 });
  }

  const result: ScheduleResponse = {
    results: (Array.isArray(body.results) ? body.results : []).map((item) => ({
      id: item.id,
      title: String(isTv ? item.name ?? '' : item.title ?? ''),
      overview: String(item.overview ?? ''),
      poster_path: item.poster_path ?? null,
      backdrop_path: item.backdrop_path ?? null,
      release_date: String(isTv ? item.first_air_date ?? '' : item.release_date ?? ''),
      vote_average: Number(item.vote_average ?? 0),
      genre_ids: item.genre_ids ?? [],
      media_type: isTv ? 'tv' : 'movie',
    })),
    page: body.page ?? page,
    total_pages: body.total_pages ?? 0,
    total_results: body.total_results ?? 0,
  };
  cache.set(cacheKey, { expires: Date.now() + cacheTtl, response: result });
  if (cache.size > 100) {
    const nowMs = Date.now();
    for (const [key, item] of cache) if (item.expires <= nowMs) cache.delete(key);
    while (cache.size > 80) cache.delete(cache.keys().next().value!);
  }
  return result;
}
