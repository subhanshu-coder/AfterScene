# Architecture

Afterscene is a TypeScript monorepo with a Vite React client and an Express API. Supabase provides authentication, PostgreSQL, storage, and the future realtime transport. TMDB calls are proxied by the API so the TMDB key stays server-side.

```text
Browser (React / Supabase Auth)
  ├── public movie reads ──> Express API ──> TMDB (5 minute bounded cache)
  └── Bearer session actions ──> Express API ──> Supabase Auth verification
                                              └── Supabase service role writes
Postgres tables <── Supabase RLS (user-scoped data)
```

The service role is only used by server routes after the caller’s access token is verified. Browser data access uses the anon key and RLS. The first shipped slice covers movie search, trending, details, account creation/sign-in/recovery, ratings, and watchlist changes. Additional product systems should be added in narrow routes/services and migrations.

## Runtime boundaries

- `frontend/src/services` contains browser API clients; never put TMDB or service-role secrets there.
- `backend/src/controllers` validates request inputs and forms responses.
- `backend/src/services` owns external-provider and database operations.
- `supabase/migrations` is the source of truth for schema and policies.

TMDB cache is process-local, bounded, and expires after five minutes. Use a shared cache only when multiple API instances need coherent reuse.
