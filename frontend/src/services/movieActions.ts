import { supabase } from '../lib/supabase';

const apiBase = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000');

export type UserMovieState = { rating: number | null; watchlistStatus: 'want_to_watch' | 'watching' | 'watched' | 'dropped' | 'favorite' | null };

async function movieAction<T>(tmdbId: number, suffix: string, method: 'GET' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to save ratings and watchlist changes.');
  const response = await fetch(`${apiBase}/api/movies/${tmdbId}${suffix}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const dataBody = await response.json() as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error(dataBody.error?.message ?? 'Your change could not be saved. Please try again.');
  return dataBody;
}

export const getUserMovieState = (tmdbId: number) => movieAction<UserMovieState>(tmdbId, '/me', 'GET');
export const saveMovieRating = (tmdbId: number, rating: number) => movieAction<{ saved: boolean }>(tmdbId, '/rating', 'PUT', { rating });
export const saveWatchlist = (tmdbId: number) => movieAction<{ saved: boolean; status: string }>(tmdbId, '/watchlist', 'PUT', { status: 'want_to_watch' });
export const setWatchlistStatus = (tmdbId: number, status: UserMovieState['watchlistStatus'] & string) => movieAction<{ saved: boolean; status: string }>(tmdbId, '/watchlist', 'PUT', { status });
export const removeWatchlist = (tmdbId: number) => movieAction<{ removed: boolean }>(tmdbId, '/watchlist', 'DELETE');

export async function getMyWatchlist() {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to view your watchlist.');
  const response = await fetch(`${apiBase}/api/movies/watchlist/me`, { headers: { authorization: `Bearer ${token}` } });
  const result = await response.json() as { error?: { message?: string }; results?: (import('../types/movie').Movie & { status: string })[] };
  if (!response.ok) throw new Error(result.error?.message ?? 'Your watchlist could not be loaded.');
  return result as { results: (import('../types/movie').Movie & { status: string })[] };
}
