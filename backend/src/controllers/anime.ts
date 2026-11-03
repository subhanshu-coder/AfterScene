import type { Request, Response, NextFunction } from 'express';
import { getPopularAnime } from '../services/tmdb.js';
import { setPublicMovieCache } from '../utils/publicCache.js';

export async function anime(_request: Request, response: Response, next: NextFunction) {
  try {
    const result = await getPopularAnime();
    setPublicMovieCache(response);
    response.json(result);
  } catch (error) { next(error); }
}
