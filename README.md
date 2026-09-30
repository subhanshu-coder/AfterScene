# Afterscene

**Your movie people. Your movie identity.** Afterscene is a movie discovery and social product built around the films people love and the conversations they start.

This repository starts with a working discovery vertical slice: responsive React interface, authenticated Supabase client foundation, server-side TMDB search and weekly trending, short-lived API caching, health/readiness endpoints, and a relational PostgreSQL schema protected by Row Level Security.

## Stack

- React, Vite, TypeScript, TanStack Query, Framer Motion, Lucide
- Express, TypeScript, Helmet, Zod, rate limiting
- Supabase Auth and PostgreSQL with RLS migrations
- TMDB for movie discovery; API key remains on the server

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and set `TMDB_API_KEY`, `SUPABASE_URL`, and the server-side Supabase keys you need.
3. In `frontend/.env.local`, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=http://localhost:4000`. The Vite-prefixed key is the public anon key only; never put the service-role key in frontend variables.
4. Install and start: `npm install` then `npm run dev`.
5. Open `http://localhost:5173`; the API listens at `http://localhost:4000`.

Apply SQL migrations with the Supabase CLI (`supabase db push`) after linking a development project. Never use production credentials for local development. The signup trigger creates the profile and preferences rows. Configure email verification and Google OAuth in Supabase Auth before enabling those provider flows.

Without a TMDB key, the interface shows a setup prompt instead of fabricated movie data. TMDB attribution is shown in the product footer. Review TMDB's current terms and branding requirements before public launch.

## API

- `GET /health` — process health
- `GET /ready` — readiness and configured TMDB dependency
- `GET /api/movies/trending` — cached weekly trending films
- `GET /api/movies/search?q=...` — validated, rate limited movie search

Responses from the API provider are cached in process memory for five minutes. This cache is bounded and appropriate for the initial single-instance setup; move it to a shared cache when deploying multiple API instances.

## Database and security

`supabase/migrations/202609300001_initial_schema.sql` defines the initial relational model for profiles, preferences, movies, ratings, posts, comments, reviews, follows, watchlists, watch history, collections, notifications, and Movie DNA snapshots. Constraints and indexes support core reads. RLS is enabled on every table. The Supabase service role key must remain server-side and is not used by the browser app.

## Product status

The project is an early foundation, not yet the full product scope. Auth UI is a first-step sign-in path; signup/onboarding, persistent social writes, feed ranking, chat/realtime, AI copilot, moderation console, and deployment automation are subsequent implementation phases. The movie search and trending endpoints are real and require a TMDB key. Account features require a Supabase project.

## Brand notes

- Name: Afterscene
- Promise: find your people; build your movie identity
- Palette: near-black, warm paper, electric lime
- Typography: Manrope display with DM Sans interface text
- Mark: original clapperboard glyph with a lime ground

TMDB is the source of movie metadata and images. Afterscene is not endorsed or certified by TMDB.
# AfterScene
