# Deployment

## Vercel

The connected Vercel workspace uses separate projects: frontend root `frontend/` and Express backend root `backend/`. Configure the frontend project's `VITE_API_URL` to the backend project's HTTPS production domain without a trailing slash. Configure backend `CLIENT_URL` to the frontend production origin. The backend exports its Express app so Vercel can run it as a function. The root `vercel.json` and `api/[...path].ts` additionally support a consolidated project rooted at the repository root.

Set these environment variables for the appropriate project and environment:

- Backend, server-only: `TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`), and `SUPABASE_SERVICE_ROLE_KEY`.
- Frontend, build-time public values: `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). Never put a service-role key in a `VITE_*` variable.

Run all Supabase migrations against the intended project before enabling database-backed features. Configure Google OAuth redirect URLs and email authentication URLs for the production frontend domain. Keep Preview and Production values separate; use non-production Supabase credentials for Preview where possible.

## Docker deployment

The multi-stage Dockerfiles build a static Nginx frontend and a non-root Node API. `docker compose up --build` serves the product at `http://localhost:8080` and proxies `/api` to the backend. Supabase remains a hosted dependency; Docker Compose does not start a local database.

CI validates lint, types, API tests, and both production builds. Verify the backend's `/health`, `/ready`, and `/api/movies/trending` endpoints and test a frontend movie search after deployment. Keep development, staging, and production Supabase projects separate.
