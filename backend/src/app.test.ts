import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from './app.js';

let server: ReturnType<typeof app.listen>;
let apiUrl = '';

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health and readiness return status without leaking configuration', async () => {
  const [healthResponse, readyResponse] = await Promise.all([fetch(`${apiUrl}/health`), fetch(`${apiUrl}/ready`)]);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });
  assert.equal(readyResponse.status, 200);
  assert.deepEqual(await readyResponse.json(), { status: 'ready', dependencies: { tmdb: Boolean(process.env.TMDB_API_KEY) } });
});

test('movie search validates query length before contacting TMDB', async () => {
  const response = await fetch(`${apiUrl}/api/movies/search?q=x`);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_QUERY');
});

test('rating writes require a verified signed-in user', async () => {
  const response = await fetch(`${apiUrl}/api/movies/12/rating`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating: 5 }) });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('invalid movie identifiers are rejected', async () => {
  const response = await fetch(`${apiUrl}/api/movies/not-a-number`);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_MOVIE_ID');
});

test('unknown API routes return a consistent not-found response', async () => {
  const response = await fetch(`${apiUrl}/api/unknown`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});
