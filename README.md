# Afterscene

**Your movie people. Your movie identity.** Afterscene is a movie discovery and social product built around the films people love and the conversations they start.

The implemented product slice includes responsive movie discovery, persistent Supabase sign-in, personal ratings and watchlists, a community AfterScene score, public movie-room messages over Supabase Realtime, community posts, follow controls, and a movie diary populated when a user marks a film watched. TMDB search and weekly trending remain server-side and cached.

## Stack

- React, Vite, TypeScript, TanStack Query, Framer Motion, Lucide
- Express, TypeScript, Helmet, Zod, rate limiting
- Supabase Auth and PostgreSQL with RLS migrations
- TMDB for movie discovery; API key remains on the server

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and set `TMDB_API_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`). User-scoped backend writes use the signed-in user token and Supabase RLS; never expose a service-role key.
3. In `frontend/.env.local`, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`), and `VITE_API_URL=http://localhost:4000`.
4. Install and start: `corepack pnpm install` then `corepack pnpm dev`.
5. Open `http://localhost:5173`; the API listens at `http://localhost:4000`.

Apply SQL migrations with the Supabase CLI (`supabase db push`) after linking a development project. Never use production credentials for local development. The signup trigger creates the profile and preferences rows. Configure email verification and Google OAuth in Supabase Auth before enabling those provider flows.

Without a TMDB key, the interface shows a setup prompt instead of fabricated movie data. TMDB attribution is shown in the product footer. Review TMDB's current terms and branding requirements before public launch.

## Deploy to Vercel

The repository supports the existing two-project Vercel setup (frontend root `frontend/`, Express backend root `backend/`). For the frontend project, set `VITE_API_URL` to the backend project's HTTPS production domain, with no trailing slash. Set `CLIENT_URL` in the backend project to the frontend site's origin. The backend exports its Express app for Vercel Functions; the top-level `vercel.json` and `api/[...path].ts` also support deploying both from the repository root as one project.

Set `TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`), and `SUPABASE_SERVICE_ROLE_KEY` as server-only backend variables. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) for the frontend build. `VITE_API_URL` is a public API origin; never put the service-role key in a `VITE_*` variable. Apply the Supabase migrations separately before expecting related database features to work.

## API

- `GET /health` — process health
- `GET /ready` — readiness and configured TMDB dependency
- `GET /api/movies/trending` — cached weekly trending films
- `GET /api/movies/search?q=...` — validated, rate limited movie search

Responses from the API provider are cached in process memory for five minutes. This cache is bounded and appropriate for the initial single-instance setup; move it to a shared cache when deploying multiple API instances.

## Database and security

`supabase/migrations/202609300001_initial_schema.sql` defines the core relational model. `supabase/migrations/202610010001_movie_community.sql` adds RLS-protected community verdicts and movie discussion messages and enables realtime for those messages. Apply new migrations to the same Supabase project before running the related feature. Ratings, watchlists, follows, posts, diary, verdicts, and messages are constrained by user-scoped RLS policies.

## Product status

This is a working early product slice, not the entire roadmap. AI copilot, recommendation ranking, full messaging, moderation console, and deployment automation remain future work. The movie search and trending endpoints require a valid TMDB key; account and community features require Supabase Auth and the migrations above.

## Brand notes

- Name: Afterscene
- Promise: find your people; build your movie identity
- Palette: near-black, warm paper, electric lime
- Typography: Manrope display with DM Sans interface text
- Mark: original clapperboard glyph with a lime ground

TMDB is the source of movie metadata and images. Afterscene is not endorsed or certified by TMDB.
