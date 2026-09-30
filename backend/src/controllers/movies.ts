import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMovieDetail, getMovies } from '../services/tmdb.js';

const searchSchema = z.string().trim().min(2).max(120);
const idSchema = z.coerce.number().int().positive();

export async function detail(request: Request, response: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(request.params.tmdbId);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_MOVIE_ID', message: 'Movie ID must be a positive number.' } });
  try { response.json(await getMovieDetail(parsed.data)); } catch (error) { next(error); }
}

export async function trending(_request: Request, response: Response, next: NextFunction) {
  try { response.json(await getMovies('trending')); } catch (error) { next(error); }
}

export async function search(request: Request, response: Response, next: NextFunction) {
  const parsed = searchSchema.safeParse(request.query.q);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Search text must be 2 to 120 characters.' } });
  try { response.json(await getMovies('search', parsed.data)); } catch (error) { next(error); }
}
