import type { Request, Response, NextFunction } from 'express';
import { getMovieDetail, getMovies } from '../services/tmdb.js';

let cached: { expires: number; results: Array<{ id: number; title: string; poster_path: string | null; release_date: string; key: string; name: string }> } | null = null;

export async function trailers(_request: Request, response: Response, next: NextFunction) {
  if (cached && cached.expires > Date.now()) return response.json({ results: cached.results });
  try {
    const popular = await getMovies('trending');
    const candidates = popular.results.slice(0, 8);
    const details = await Promise.all(candidates.map(async (movie) => {
      try { return { movie, detail: await getMovieDetail(movie.id) }; }
      catch { return null; }
    }));
    const results = details.flatMap((entry) => {
      if (!entry) return [];
      const videos = entry.detail.videos as { results?: Array<{ key?: string; name?: string; site?: string; type?: string; official?: boolean }> } | undefined;
      const trailer = videos?.results?.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.key);
      return trailer ? [{ id: entry.movie.id, title: entry.movie.title, poster_path: entry.movie.poster_path, release_date: entry.movie.release_date, key: trailer.key!, name: trailer.name ?? 'Official trailer' }] : [];
    });
    cached = { expires: Date.now() + 5 * 60_000, results };
    response.json({ results });
  } catch (error) { next(error); }
}
