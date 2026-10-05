import type { Request, Response, NextFunction } from 'express';
import { getHotstarMovies } from '../services/tmdb.js';

export async function hotstar(_request: Request, response: Response, next: NextFunction) {
  try { response.json(await getHotstarMovies()); } catch (error) { next(error); }
}
