import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMovieDetail } from '../services/tmdb.js';
import { getServiceClient } from '../services/supabase.js';

const idSchema = z.coerce.number().int().positive();
const ratingSchema = z.object({ rating: z.number().min(0.5).max(5).refine((rating) => Number.isInteger(rating * 2)) });
const statusSchema = z.object({ status: z.enum(['want_to_watch', 'watching', 'watched', 'dropped', 'favorite']) }).default({ status: 'want_to_watch' });

async function getDatabaseMovieId(tmdbId: number) {
  const details = await getMovieDetail(tmdbId);
  const db = getServiceClient();
  const title = typeof details.title === 'string' ? details.title : '';
  if (!title) throw Object.assign(new Error('Movie data is incomplete.'), { statusCode: 502 });
  const genres = Array.isArray(details.genres) ? details.genres.flatMap((genre) => {
    if (typeof genre === 'object' && genre !== null && 'id' in genre && typeof genre.id === 'number') return [genre.id];
    return [];
  }) : [];
  const metadata = { overview: details.overview, runtime: details.runtime, vote_average: details.vote_average, original_language: details.original_language, credits: details.credits, videos: details.videos };
  const { data, error } = await db.from('movies').upsert({
    tmdb_id: tmdbId,
    title,
    poster_path: typeof details.poster_path === 'string' ? details.poster_path : null,
    backdrop_path: typeof details.backdrop_path === 'string' ? details.backdrop_path : null,
    release_date: typeof details.release_date === 'string' && details.release_date ? details.release_date : null,
    genres,
    metadata,
    cached_at: new Date().toISOString(),
  }, { onConflict: 'tmdb_id' }).select('id').single();
  if (error) throw Object.assign(new Error('Movie details could not be saved.'), { statusCode: 503 });
  return { db, movieId: data.id as string };
}

export async function setRating(request: Request, response: Response, next: NextFunction) {
  const movieId = idSchema.safeParse(request.params.tmdbId);
  const body = ratingSchema.safeParse(request.body);
  if (!movieId.success || !body.success) return response.status(400).json({ error: { code: 'INVALID_RATING', message: 'Choose a rating from 0.5 to 5 stars in half-star steps.' } });
  try {
    const { db, movieId: internalId } = await getDatabaseMovieId(movieId.data);
    const { error } = await db.from('movie_ratings').upsert({ user_id: response.locals.userId as string, movie_id: internalId, rating: body.data.rating }, { onConflict: 'user_id,movie_id' });
    if (error) throw Object.assign(new Error('Your rating could not be saved.'), { statusCode: 503 });
    response.json({ saved: true, rating: body.data.rating });
  } catch (error) { next(error); }
}

export async function setWatchlistStatus(request: Request, response: Response, next: NextFunction) {
  const movieId = idSchema.safeParse(request.params.tmdbId);
  const body = statusSchema.safeParse(request.body ?? {});
  if (!movieId.success || !body.success) return response.status(400).json({ error: { code: 'INVALID_WATCHLIST_ENTRY', message: 'Choose a valid watch status.' } });
  try {
    const { db, movieId: internalId } = await getDatabaseMovieId(movieId.data);
    const { error } = await db.from('watchlists').upsert({ user_id: response.locals.userId as string, movie_id: internalId, status: body.data.status }, { onConflict: 'user_id,movie_id' });
    if (error) throw Object.assign(new Error('This movie could not be added to your collection.'), { statusCode: 503 });
    response.json({ saved: true, status: body.data.status });
  } catch (error) { next(error); }
}

export async function removeFromWatchlist(request: Request, response: Response, next: NextFunction) {
  const movieId = idSchema.safeParse(request.params.tmdbId);
  if (!movieId.success) return response.status(400).json({ error: { code: 'INVALID_MOVIE_ID', message: 'Movie ID must be a positive number.' } });
  try {
    const db = getServiceClient();
    const { data: movie, error: movieError } = await db.from('movies').select('id').eq('tmdb_id', movieId.data).maybeSingle();
    if (movieError) throw Object.assign(new Error('Your collection could not be updated.'), { statusCode: 503 });
    if (!movie) return response.json({ removed: true });
    const { error } = await db.from('watchlists').delete().eq('user_id', response.locals.userId as string).eq('movie_id', movie.id);
    if (error) throw Object.assign(new Error('Your collection could not be updated.'), { statusCode: 503 });
    response.json({ removed: true });
  } catch (error) { next(error); }
}

export async function getUserMovieState(request: Request, response: Response, next: NextFunction) {
  const movieId = idSchema.safeParse(request.params.tmdbId);
  if (!movieId.success) return response.status(400).json({ error: { code: 'INVALID_MOVIE_ID', message: 'Movie ID must be a positive number.' } });
  try {
    const db = getServiceClient();
    const { data: movie, error: movieError } = await db.from('movies').select('id').eq('tmdb_id', movieId.data).maybeSingle();
    if (movieError) throw Object.assign(new Error('Your movie details could not be loaded.'), { statusCode: 503 });
    if (!movie) return response.json({ rating: null, watchlistStatus: null });
    const userId = response.locals.userId as string;
    const [rating, watchlist] = await Promise.all([
      db.from('movie_ratings').select('rating').eq('user_id', userId).eq('movie_id', movie.id).maybeSingle(),
      db.from('watchlists').select('status').eq('user_id', userId).eq('movie_id', movie.id).maybeSingle(),
    ]);
    if (rating.error || watchlist.error) throw Object.assign(new Error('Your movie details could not be loaded.'), { statusCode: 503 });
    response.json({ rating: rating.data?.rating ?? null, watchlistStatus: watchlist.data?.status ?? null });
  } catch (error) { next(error); }
}
