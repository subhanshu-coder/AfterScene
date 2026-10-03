# Deployment

## Vercel Services

Import the GitHub repository with the Vercel Services framework from the repository root. Root `vercel.json` defines the frontend service (`frontend/`, Vite) and backend service (`backend/`, Express). It routes `/api/*`, `/health`, and `/ready` to the backend and sends other requests to the frontend. The frontend uses same-origin `/api` URLs; do not configure a Render URL or `VITE_API_URL` in production.

Configure variables for the correct Vercel service and environment:

- Backend service (server-only): `TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Frontend service (build-time public values): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`.

Never add a service-role key to a `VITE_*` variable. Supabase publishable/anon keys are public and must be protected by RLS. Run all migrations against the intended Supabase project before enabling the related feature. Configure Google OAuth redirect URLs and email auth URLs for the Vercel site domain.

## Docker

The multi-stage Dockerfiles build a static Nginx frontend and a non-root Node API. `docker compose up --build` serves the product at `http://localhost:8080` and proxies `/api` to the backend. Supabase remains hosted; Docker Compose does not start a local database.

Verify `/health`, `/ready`, movie discovery, login, and a user-scoped rating/watchlist mutation after deployment. Keep Preview and Production Supabase credentials separate.
