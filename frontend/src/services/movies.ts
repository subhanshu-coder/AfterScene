import type { MovieResponse } from '../types/movie';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function getMovies(path: string, signal?: AbortSignal): Promise<MovieResponse> {
  const response = await fetch(`${apiBase}/api/movies/${path}`, { signal });
  if (!response.ok) throw new Error(response.status === 503 ? 'Connect a TMDB API key to enable movie discovery.' : 'Movie data could not be loaded. Please try again.');
  return response.json() as Promise<MovieResponse>;
}

export const discoverMovies = (signal?: AbortSignal) => getMovies('trending', signal);
export const searchMovies = (query: string, signal?: AbortSignal) => getMovies(`search?q=${encodeURIComponent(query)}`, signal);
