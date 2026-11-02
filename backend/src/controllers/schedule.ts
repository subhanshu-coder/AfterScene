import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMovieSchedule } from '../services/movieSchedule.js';

const scheduleQuery = z.object({
  bucket: z.enum(['released', 'today', 'upcoming', 'announced']),
  year: z.coerce.number().int().min(1900).max(2100),
  page: z.coerce.number().int().min(1).max(500).default(1),
  media: z.enum(['movie', 'tv', 'anime']).default('movie'),
});

export async function schedule(request: Request, response: Response, next: NextFunction) {
  const parsed = scheduleQuery.safeParse(request.query);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_SCHEDULE_FILTER', message: 'Choose a valid title type, release category, and year.' } });
  try {
    const result = await getMovieSchedule(parsed.data.bucket, parsed.data.year, parsed.data.page, parsed.data.media);
    response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=300');
    response.json(result);
  } catch (error) {
    next(error);
  }
}
