import type { MovieResponse } from '../types/movie';

const apiBase = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000');

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
