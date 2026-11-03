import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMoodMovies, getStreamingMovies } from '../services/tmdb.js';
import { setPublicMovieCache } from '../utils/publicCache.js';

const providerSchema = z.string().trim().min(2).max(40).regex(/^[a-zA-Z ]+$/);
const genreSchema = z.coerce.number().int().positive().max(999);

export async function streaming(request: Request, response: Response, next: NextFunction) {
  const parsed = providerSchema.safeParse(request.query.provider);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_PROVIDER', message: 'Choose a supported streaming provider.' } });
  try {
    const result = await getStreamingMovies(parsed.data);
    setPublicMovieCache(response);
    response.json(result);
  } catch (error) { next(error); }
}

export async function mood(request: Request, response: Response, next: NextFunction) {
  const parsed = genreSchema.safeParse(request.query.genre);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_MOOD', message: 'Choose a valid movie mood.' } });
  try { response.json(await getMoodMovies(parsed.data)); } catch (error) { next(error); }
}
