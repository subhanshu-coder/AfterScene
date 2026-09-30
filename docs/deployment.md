# Deployment

The two multi-stage Dockerfiles build a static Nginx frontend and a non-root Node API. `docker compose up --build` serves the product at `http://localhost:8080` and proxies `/api` to the backend. Supabase remains a hosted dependency; this setup does not start a local database.

Copy `.env.example` to `.env`, add backend `TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before building. The Vite-prefixed anon key is public by design; never use the service-role key there. Image build arguments are embedded in the client bundle, so only public values belong there.

CI validates lint, types, API tests, and both production builds. A deployment target and its environment-specific credentials have not been selected, so production CD is intentionally not configured. Keep development, staging, and production Supabase projects separate.
