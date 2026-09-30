import { env } from '../config/env.js';

type TmdbResult = { id: number; title: string; overview: string; poster_path: string | null; backdrop_path: string | null; release_date: string; vote_average: number; genre_ids: number[] };
type TmdbResponse = { results: TmdbResult[]; page: number; total_pages: number; total_results: number };

const cache = new Map<string, { expires: number; data: TmdbResponse }>();
const detailCache = new Map<number, { expires: number; data: Record<string, unknown> }>();
const ttlMs = 5 * 60_000;

export async function getMovieDetail(tmdbId: number): Promise<Record<string, unknown>> {
  if (!env.TMDB_API_KEY) throw Object.assign(new Error('Movie discovery is not configured yet.'), { statusCode: 503 });
  const cached = detailCache.get(tmdbId);
  if (cached && cached.expires > Date.now()) return cached.data;
  const url = new URL(`${env.TMDB_BASE_URL}/movie/${tmdbId}`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('append_to_response', 'credits,videos,similar');
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (response.status === 404) throw Object.assign(new Error('That movie could not be found.'), { statusCode: 404 });
  if (!response.ok) throw Object.assign(new Error('Movie data provider returned an error.'), { statusCode: response.status === 429 ? 503 : 502 });
  const data = await response.json() as Record<string, unknown>;
  detailCache.set(tmdbId, { expires: Date.now() + ttlMs, data });
  if (detailCache.size > 200) {
    const now = Date.now();
    for (const [key, value] of detailCache) if (value.expires <= now) detailCache.delete(key);
    while (detailCache.size > 175) detailCache.delete(detailCache.keys().next().value!);
  }
  return data;
}

export async function getMovies(kind: 'trending' | 'search', query?: string): Promise<TmdbResponse> {
  if (!env.TMDB_API_KEY) throw Object.assign(new Error('Movie discovery is not configured yet.'), { statusCode: 503 });
  const cacheKey = `${kind}:${query ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  const endpoint = kind === 'trending' ? '/trending/movie/week' : '/search/movie';
  const url = new URL(`${env.TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', '1');
  if (query) url.searchParams.set('query', query);
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw Object.assign(new Error('Movie data provider returned an error.'), { statusCode: response.status === 429 ? 503 : 502 });
  const data = await response.json() as TmdbResponse;
  cache.set(cacheKey, { expires: Date.now() + ttlMs, data });
  if (cache.size > 300) {
    const now = Date.now();
    for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
    while (cache.size > 250) cache.delete(cache.keys().next().value!);
  }
  return data;
}
