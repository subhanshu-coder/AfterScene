import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = Number(error?.statusCode) || 500;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : 'Unknown error', time: new Date().toISOString() }));
  const message = (status < 500 || status === 502 || status === 503) && error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.';
  response.status(status).json({ error: { code: status === 503 ? 'SERVICE_UNAVAILABLE' : 'REQUEST_FAILED', message } });
};
