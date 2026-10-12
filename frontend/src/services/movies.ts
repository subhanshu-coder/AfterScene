import type { MovieResponse } from '../types/movie';

const apiBase = import.meta.env.PROD ? '' : import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function getMovies(path: string, signal?: AbortSignal): Promise<MovieResponse> {
  const response = await fetch(`${apiBase}/api/movies/${path}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (response.status === 503) throw new Error(body?.error?.message ?? 'Add TMDB_API_KEY to the backend environment to enable movie discovery.');
    throw new Error(body?.error?.message ?? 'Movie data could not be loaded. Please try again.');
  }
  return response.json() as Promise<MovieResponse>;
}

export const discoverMovies = (signal?: AbortSignal) => getMovies('trending', signal);
export const searchMovies = (query: string, signal?: AbortSignal) => getMovies(`search?q=${encodeURIComponent(query)}`, signal);
export const getAnime = (signal?: AbortSignal) => getMovies('anime', signal);
export const getStreamingMovies = async (provider: string, signal?: AbortSignal): Promise<{ providerName: string | null; results: MovieResponse['results'] }> => {
  const response = await fetch(`${apiBase}/api/movies/streaming?provider=${encodeURIComponent(provider)}`, { signal });
  const body = await response.json() as { providerName?: string | null; results?: MovieResponse['results']; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Streaming picks could not be loaded.');
  return { providerName: body.providerName ?? null, results: body.results ?? [] };
};

export const getHotstarMovies = (signal?: AbortSignal) => getStreamingMovies('Hotstar', signal);
export const getMoodMovies = async (genreId: number, signal?: AbortSignal): Promise<MovieResponse> => {
  const response = await fetch(`${apiBase}/api/movies/mood?genre=${genreId}`, { signal });
  const body = await response.json() as MovieResponse & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Mood picks could not be loaded.');
  return body;
};

export type ScheduleBucket = 'released' | 'today' | 'upcoming' | 'announced';

export const getMovieSchedule = async (bucket: ScheduleBucket, year: number, signal?: AbortSignal, page = 1): Promise<MovieResponse> => {
  const response = await fetch(`${apiBase}/api/movies/schedule?bucket=${bucket}&year=${year}&page=${page}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'The release schedule could not be loaded.');
  }
  return response.json() as Promise<MovieResponse>;
};

export type MovieTrailer = { id: number; title: string; poster_path: string | null; release_date: string; key: string; name: string };

export const getMovieTrailers = async (signal?: AbortSignal): Promise<MovieTrailer[]> => {
  const response = await fetch(`${apiBase}/api/movies/trailers`, { signal });
  const body = await response.json() as { results?: MovieTrailer[]; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Trailers could not be loaded.');
  return body.results ?? [];
};
