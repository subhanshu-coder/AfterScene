import type { RequestHandler } from 'express';
import { getUserId } from '../services/supabase.js';

export const requireUser: RequestHandler = async (request, response, next) => {
  const match = /^Bearer\s+(.+)$/i.exec(request.header('authorization') ?? '');
  if (!match) return response.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
  try {
    const userId = await getUserId(match[1]);
    if (!userId) return response.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Your session has expired. Please sign in again.' } });
    response.locals.userId = userId;
    next();
  } catch (error) { next(error); }
};
