import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMovieSchedule } from '../services/movieSchedule.js';

const scheduleQuery = z.object({
  bucket: z.enum(['released', 'today', 'upcoming', 'announced']),
  year: z.coerce.number().int().min(1900).max(2100),
});

export async function schedule(request: Request, response: Response, next: NextFunction) {
  const parsed = scheduleQuery.safeParse(request.query);
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_SCHEDULE_FILTER', message: 'Choose a valid release category and year.' } });
  try {
    response.json(await getMovieSchedule(parsed.data.bucket, parsed.data.year));
  } catch (error) {
    next(error);
  }
}
