import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMovieDetail, getMovies } from '../services/tmdb.js';

const searchSchema = z.string().trim().min(2).max(120);
const idSchema = z.coerce.number().int().positive();
const pageSchema = z.coerce.number().int().min(1).max(500).default(1);

export async function detail(request: Request, response: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(request.params.tmdbId);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_MOVIE_ID', message: 'Movie ID must be a positive number.' } });
  try { response.json(await getMovieDetail(parsed.data)); } catch (error) { next(error); }
}

export async function trending(request: Request, response: Response, next: NextFunction) {
  const parsed = pageSchema.safeParse(request.query.page ?? 1);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_PAGE', message: 'Page must be between 1 and 500.' } });
  try { response.json(await getMovies('trending', undefined, parsed.data)); } catch (error) { next(error); }
}

export async function search(request: Request, response: Response, next: NextFunction) {
  const parsed = searchSchema.safeParse(request.query.q);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Search text must be 2 to 120 characters.' } });
  try { response.json(await getMovies('search', parsed.data)); } catch (error) { next(error); }
}
