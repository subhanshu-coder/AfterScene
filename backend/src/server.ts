import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => console.info(JSON.stringify({ level: 'info', message: `Afterscene API listening on ${env.PORT}` })));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
