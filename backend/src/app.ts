import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import movieRoutes from './routes/movies.js';
import { errorHandler } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CLIENT_URL, methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxAge: 600 }));
app.use(express.json({ limit: '32kb' }));
app.use((request, response, next) => {
  const requestId = randomUUID();
  const startedAt = performance.now();
  response.setHeader('x-request-id', requestId);
  response.on('finish', () => console.info(JSON.stringify({ level: 'info', requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Math.round(performance.now() - startedAt), time: new Date().toISOString() })));
  next();
});
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/ready', (_request, response) => response.json({ status: 'ready', dependencies: { tmdb: Boolean(process.env.TMDB_API_KEY) } }));
app.use('/api/movies', movieRoutes);
app.use((_request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That page could not be found.' } }));
app.use(errorHandler);
