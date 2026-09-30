# API

Base path: `/api`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Authenticated writes accept `Authorization: Bearer <Supabase access token>`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | No | Liveness check |
| GET | `/ready` | No | Readiness and dependency configuration |
| GET | `/api/movies/trending` | No | Weekly TMDB trending |
| GET | `/api/movies/search?q=...` | No | Validated, rate-limited movie search |
| GET | `/api/movies/:tmdbId` | No | Movie details, cast, trailer, similar titles |
| GET | `/api/movies/:tmdbId/me` | Yes | Current user rating and watchlist state |
| PUT | `/api/movies/:tmdbId/rating` | Yes | Upsert a half-step rating from 0.5–5 |
| PUT | `/api/movies/:tmdbId/watchlist` | Yes | Upsert watch status |
| DELETE | `/api/movies/:tmdbId/watchlist` | Yes | Remove a watchlist row |

Movie metadata is cached in-process for five minutes. Search input is limited to 120 characters and rate limited. Mutating movie routes validate the bearer token with Supabase Auth and write using a server-only service key.
