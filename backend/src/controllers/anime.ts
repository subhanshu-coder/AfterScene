import type { Request, Response, NextFunction } from 'express';
import { getPopularAnime } from '../services/tmdb.js';

export async function anime(_request: Request, response: Response, next: NextFunction) {
  try { response.json(await getPopularAnime()); } catch (error) { next(error); }
}
