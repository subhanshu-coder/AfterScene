import type { Response } from 'express';

/**
 * Apply short browser caching and shared edge caching to public movie data.
 * Use only for responses that are identical for signed-in and anonymous users.
 */
export function setPublicMovieCache(response: Response, sharedMaxAgeSeconds = 300) {
  response.setHeader(
    'Cache-Control',
    `public, max-age=60, s-maxage=${sharedMaxAgeSeconds}, stale-while-revalidate=120`,
  );
}
