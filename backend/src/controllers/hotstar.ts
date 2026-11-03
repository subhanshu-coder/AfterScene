import type { Request, Response, NextFunction } from 'express';
import { getHotstarMovies } from '../services/tmdb.js';
import { setPublicMovieCache } from '../utils/publicCache.js';

export async function hotstar(_request: Request, response: Response, next: NextFunction) {
  try {
    const result = await getHotstarMovies();
    setPublicMovieCache(response);
    response.json(result);
  } catch (error) { next(error); }
}
