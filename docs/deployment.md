# Deployment

## Vercel full-stack deployment

Use the repository root as the Vercel project root. The repository-level `vercel.json` builds the Vite client to `frontend/dist`, sends API requests to the serverless Express adapter at `api/[...path].ts`, rewrites `/health` and `/ready` to backend health handlers, and serves the SPA for other paths. Production frontend API requests are same-origin and do not rely on Render.

Configure these variables in Vercel for each environment:

- Server-only: `TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`), and `SUPABASE_SERVICE_ROLE_KEY`.
- Build-time client values: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). These are public; never add a service-role key to a `VITE_*` variable.

Run all migrations against the intended Supabase project before enabling database-backed features. Configure Google OAuth redirect URLs and email authentication URLs for the production Vercel domain in Supabase Auth. Keep Preview and Production variables scoped separately and use non-production Supabase credentials for Preview where possible.

## Docker deployment

The multi-stage Dockerfiles build a static Nginx frontend and a non-root Node API. `docker compose up --build` serves the product at `http://localhost:8080` and proxies `/api` to the backend. Supabase remains a hosted dependency; Docker Compose does not start a local database.

CI validates lint, types, API tests, and both production builds. Review the Vercel deployment checks and verify `/health`, `/ready`, and `/api/movies/trending` after every production promotion. Keep development, staging, and production Supabase projects separate.
