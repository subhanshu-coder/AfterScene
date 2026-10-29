import type { MovieResponse } from '../types/movie';

type MovieApiError = { error?: { message?: string } };
type MovieApiParams = Record<string, string | number | undefined>;

const apiBase = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '').replace(/\/api$/, '');

function movieApiUrl(path: string, params: MovieApiParams = {}) {
  const url = new URL(`${apiBase}/api/movies/${path.replace(/^\\/+/, '')}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new Error('The movie API returned a web page instead of JSON. Check the Vercel API proxy and Render backend.');
  }
  try {
    return await response.json() as T;
  } catch {
    throw new Error('The movie service returned invalid JSON. Please try again.');
  }
}

async function requestMovieApi<T extends MovieApiError>(path: string, params: MovieApiParams, signal: AbortSignal | undefined, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(movieApiUrl(path, params), { method: 'GET', signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The movie service could not be reached. Check your connection and try again.');
  }
  const body = await readJson<T>(response);
  if (!response.ok) throw new Error(body.error?.message ?? fallback);
  return body;
}

async function getMovies(path: string, signal?: AbortSignal, params: MovieApiParams = {}): Promise<MovieResponse> {
  return requestMovieApi<MovieResponse & MovieApiError>(path, params, signal, 'Movie data could not be loaded. Please try again.');
}

export const discoverMovies = (signal?: AbortSignal, page = 1) => getMovies('trending', signal, { page });
export const searchMovies = (query: string, signal?: AbortSignal) => getMovies('search', signal, { q: query });
export const getAnime = (signal?: AbortSignal) => getMovies('anime', signal);
export const getStreamingMovies = async (provider: string, signal?: AbortSignal): Promise<{ providerName: string | null; results: MovieResponse['results'] }> => {
  const body = await requestMovieApi<{ providerName?: string | null; results?: MovieResponse['results'] } & MovieApiError>('streaming', { provider }, signal, 'Streaming picks could not be loaded.');
  return { providerName: body.providerName ?? null, results: body.results ?? [] };
};

const hotstarProvider = 'Hotstar';
export const getHotstarMovies = (signal?: AbortSignal) => getStreamingMovies(hotstarProvider, signal);
export const getMoodMovies = (genreId: number, signal?: AbortSignal): Promise<MovieResponse> =>
  requestMovieApi<MovieResponse & MovieApiError>('mood', { genre: genreId }, signal, 'Mood picks could not be loaded.');

export type ScheduleBucket = 'released' | 'today' | 'upcoming' | 'announced';
export type ScheduleMedia = 'movie' | 'tv' | 'anime';

export const getMovieSchedule = async (bucket: ScheduleBucket, year: number, signal?: AbortSignal, page = 1, media: ScheduleMedia = 'movie'): Promise<MovieResponse> => {
  return requestMovieApi<MovieResponse & MovieApiError>('schedule', { bucket, year, page, media }, signal, 'The release schedule could not be loaded.');
};

export type MovieTrailer = { id: number; title: string; poster_path: string | null; release_date: string; key: string; name: string };

export const getMovieTrailers = async (signal?: AbortSignal): Promise<MovieTrailer[]> => {
  const response = await fetch(`${apiBase}/api/movies/trailers`, { signal });
  const body = await readJson<{ results?: MovieTrailer[]; error?: { message?: string } }>(response);
  if (!response.ok) throw new Error(body.error?.message ?? 'Trailers could not be loaded.');
  return body.results ?? [];
};
