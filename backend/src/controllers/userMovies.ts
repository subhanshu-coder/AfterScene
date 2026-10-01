import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMovieDetail } from '../services/tmdb.js';
import { getUserClient } from '../services/supabase.js';

const idSchema = z.coerce.number().int().positive();
const ratingSchema = z.object({ rating: z.number().min(0.5).max(5).refine((rating) => Number.isInteger(rating * 2)) });
const statusSchema = z.object({ status: z.enum(['want_to_watch', 'watching', 'watched', 'dropped', 'favorite']) }).default({ status: 'want_to_watch' });
const verdictSchema = z.object({ verdict: z.enum(['skip', 'time_pass', 'good', 'love']) });

function getToken(request: Request) {
  return /^Bearer\s+(.+)$/i.exec(request.header('authorization') ?? '')?.[1] ?? '';
}

async function getDatabaseMovieId(tmdbId: number, token: string) {
  const db = getUserClient(token);
  const { data: existing, error: lookupError } = await db.from('movies').select('id').eq('tmdb_id', tmdbId).maybeSingle();
  if (lookupError) throw Object.assign(new Error('Movie data could not be loaded from your library.'), { statusCode: 503 });
  if (existing) return { db, movieId: existing.id as string };
  const details = await getMovieDetail(tmdbId);
  const title = typeof details.title === 'string' ? details.title : '';
  if (!title) throw Object.assign(new Error('Movie data is incomplete.'), { statusCode: 502 });
  const genres = Array.isArray(details.genres) ? details.genres.flatMap((genre) => {
    if (typeof genre === 'object' && genre !== null && 'id' in genre && typeof genre.id === 'number') return [genre.id];
    return [];
  }) : [];
  const metadata = { overview: details.overview, runtime: details.runtime, vote_average: details.vote_average, original_language: details.original_language, credits: details.credits, videos: details.videos };
  const { data, error } = await db.from('movies').insert({
    tmdb_id: tmdbId,
    title,
    poster_path: typeof details.poster_path === 'string' ? details.poster_path : null,
    backdrop_path: typeof details.backdrop_path === 'string' ? details.backdrop_path : null,
    release_date: typeof details.release_date === 'string' && details.release_date ? details.release_date : null,
    genres,
    metadata,
    cached_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw Object.assign(new Error('Movie details could not be saved.'), { statusCode: 503 });
  return { db, movieId: data.id as string };
}

export async function setRating(request: Request, response: Response, next: NextFunction) {
  const movieId = idSchema.safeParse(request.params.tmdbId);
  const body = ratingSchema.safeParse(request.body);
  if (!movieId.success || !body.success) return response.status(400).json({ error: { code: 'INVALID_RATING', message: 'Choose a rating from 0.5 to 5 stars in half-star steps.' } });
  try {
    const { db, movieId: internalId } = await getDatabaseMovieId(movieId.data, getToken(request));
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
    const { db, movieId: internalId } = await getDatabaseMovieId(movieId.data, getToken(request));
    const { error } = await db.from('watchlists').upsert({ user_id: response.locals.userId as string, movie_id: internalId, status: body.data.status }, { onConflict: 'user_id,movie_id' });
    if (error) throw Object.assign(new Error('This movie could not be added to your collection.'), { statusCode: 503 });
    if (body.data.status === 'watched') {
      const userId = response.locals.userId as string;
      const watchedOn = new Date().toISOString().slice(0, 10);
      const { data: existingEntry, error: historyLookupError } = await db.from('watch_history').select('id').eq('user_id', userId).eq('movie_id', internalId).eq('watched_on', watchedOn).limit(1).maybeSingle();
      if (historyLookupError) throw Object.assign(new Error('The movie was saved, but your diary could not be updated.'), { statusCode: 503 });
      if (!existingEntry) {
        const { error: historyError } = await db.from('watch_history').insert({ user_id: userId, movie_id: internalId, watched_on: watchedOn });
        if (historyError) throw Object.assign(new Error('The movie was saved, but your diary could not be updated.'), { statusCode: 503 });
      }
    }
    response.json({ saved: true, status: body.data.status });
  } catch (error) { next(error); }
}

export async function removeFromWatchlist(request: Request, response: Response, next: NextFunction) {
  const movieId = idSchema.safeParse(request.params.tmdbId);
  if (!movieId.success) return response.status(400).json({ error: { code: 'INVALID_MOVIE_ID', message: 'Movie ID must be a positive number.' } });
  try {
    const db = getUserClient(getToken(request));
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
    const db = getUserClient(getToken(request));
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

export async function listWatchlist(request: Request, response: Response, next: NextFunction) {
  try {
    const db = getUserClient(getToken(request));
    const { data, error } = await db.from('watchlists')
      .select('status,position,updated_at,movies(tmdb_id,title,poster_path,backdrop_path,release_date,metadata)')
      .eq('user_id', response.locals.userId as string)
      .order('position', { ascending: true }).limit(100);
    if (error) throw Object.assign(new Error('Your watchlist could not be loaded.'), { statusCode: 503 });
    response.json({ results: (data ?? []).map((entry) => {
      const movie = entry.movies as unknown as { tmdb_id: number; title: string; poster_path: string | null; backdrop_path: string | null; release_date: string | null; metadata: Record<string, unknown> };
      return { id: Number(movie.tmdb_id), title: movie.title, poster_path: movie.poster_path, backdrop_path: movie.backdrop_path, release_date: movie.release_date ?? '', overview: String(movie.metadata?.overview ?? ''), vote_average: Number(movie.metadata?.vote_average ?? 0), genre_ids: [], status: entry.status };
    }) });
  } catch (error) { next(error); }
}

export async function getCommunityVerdict(request: Request, response: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(request.params.tmdbId);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_MOVIE_ID', message: 'Movie ID must be a positive number.' } });
  try {
    const db = getUserClient(getToken(request) || undefined);
    const { data: movie, error: movieError } = await db.from('movies').select('id').eq('tmdb_id', parsed.data).maybeSingle();
    if (movieError) throw Object.assign(new Error('Community score could not be loaded.'), { statusCode: 503 });
    if (!movie) return response.json({ count: 0, score: null, distribution: { skip: 0, time_pass: 0, good: 0, love: 0 } });
    const { data, error } = await db.from('movie_verdicts').select('verdict').eq('movie_id', movie.id);
    if (error) throw Object.assign(new Error('Community score could not be loaded.'), { statusCode: 503 });
    const distribution = { skip: 0, time_pass: 0, good: 0, love: 0 };
    for (const row of data ?? []) distribution[row.verdict as keyof typeof distribution]++;
    const weights = { skip: 0, time_pass: 1, good: 2, love: 3 };
    const count = data?.length ?? 0;
    const score = count ? Math.round((data!.reduce((total, row) => total + weights[row.verdict as keyof typeof weights], 0) / (count * 3)) * 100) : null;
    response.json({ count, score, distribution });
  } catch (error) { next(error); }
}

export async function setCommunityVerdict(request: Request, response: Response, next: NextFunction) {
  const parsedId = idSchema.safeParse(request.params.tmdbId);
  const body = verdictSchema.safeParse(request.body);
  if (!parsedId.success || !body.success) return response.status(400).json({ error: { code: 'INVALID_VERDICT', message: 'Choose skip, time-pass, good, or love.' } });
  try {
    const { db, movieId } = await getDatabaseMovieId(parsedId.data, getToken(request));
    const { error } = await db.from('movie_verdicts').upsert({ user_id: response.locals.userId as string, movie_id: movieId, verdict: body.data.verdict }, { onConflict: 'user_id,movie_id' });
    if (error) throw Object.assign(new Error('Your movie verdict could not be saved.'), { statusCode: 503 });
    response.json({ saved: true, verdict: body.data.verdict });
  } catch (error) { next(error); }
}
