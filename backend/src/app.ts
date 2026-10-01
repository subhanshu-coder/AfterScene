import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import movieRoutes from './routes/movies.js';
import { errorHandler } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https://image.tmdb.org'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://api.themoviedb.org'],
      frameSrc: ["'self'", 'https://www.youtube.com'],
    },
  },
}));
const localOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']);
const deploymentOrigins = ['https://afterscene.onrender.com', process.env.RENDER_EXTERNAL_URL, process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => origin.startsWith('http') ? origin : `https://${origin}`);
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === env.CLIENT_URL || deploymentOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && localOrigins.has(origin))) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  maxAge: 600,
}));
app.use(express.json({ limit: '32kb' }));
app.use((request, response, next) => {
  const requestId = randomUUID();
  const startedAt = performance.now();
  response.setHeader('x-request-id', requestId);
  response.on('finish', () => console.info(JSON.stringify({ level: 'info', requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Math.round(performance.now() - startedAt), time: new Date().toISOString() })));
  next();
});
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/ready', (_request, response) => {
  const tmdbConfigured = Boolean(process.env.TMDB_API_KEY);
  response.status(tmdbConfigured ? 200 : 503).json({ status: tmdbConfigured ? 'ready' : 'degraded', dependencies: { tmdb: tmdbConfigured } });
});
app.use('/api/movies', movieRoutes);
app.use('/api', (_request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That page could not be found.' } }));

const frontendDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
app.use(express.static(frontendDist, { index: false }));
app.get('*', (_request, response, next) => {
  const indexFile = resolve(frontendDist, 'index.html');
  if (!existsSync(indexFile)) return next();
  response.sendFile(indexFile, (error) => { if (error) next(error); });
});
app.use((_request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That page could not be found.' } }));
app.use(errorHandler);
