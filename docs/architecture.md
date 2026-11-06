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


## Community feed refresh and query bounds

The community view subscribes to Supabase Realtime only while a relevant lane is active. Feed, Discussions, and Trending watch post-related changes; Reviews and Collections watch their own data. Changes are debounced before invalidating the matching TanStack Query key, and the subscription and pending timer are removed when the lane changes or unmounts. This keeps idle screens unsubscribed and avoids a separate refresh for every row in a burst.

Community reads remain bounded: the feed fetches a fixed page of posts and a capped comment set; review replies and collection items also have explicit caps. Reply groups and collection item totals are computed in a single pass on the client. If these lanes need deeper histories, add cursor pagination rather than raising the caps without limit.


## Community feed pagination and ranking

The community Feed, Discussions, and Trending lanes load posts in 20-row offset pages through TanStack Query infinite queries. A short page ends pagination; users request older posts with the explicit Load more control. Related comments, reactions, reposts, and profile rows are queried only for the current page. The Feed ranks those loaded posts using follow relationships, interaction counts, and recency; Trending uses its separate engagement-velocity score. Ranking is deterministic for the same underlying data and query time.
