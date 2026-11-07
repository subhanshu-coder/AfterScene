# API

Base path: `/api`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Authenticated writes accept `Authorization: Bearer <Supabase access token>`.

## Health

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | No | Liveness check |
| GET | `/ready` | No | Readiness and dependency configuration |
| GET | `/api/health` | No | Liveness check through the API proxy |
| GET | `/api/ready` | No | Readiness through the API proxy |

## Movie discovery

| Method | Path | Query | Purpose |
| --- | --- | --- | --- |
| GET | `/api/movies/trending` | `page` (optional, 1–500) | Weekly TMDB trending films |
| GET | `/api/movies/search` | `q` (2–120 chars) | Search movies |
| GET | `/api/movies/:tmdbId` | — | Movie details, cast, trailer, and similar titles |
| GET | `/api/movies/schedule` | `bucket`, `year`, `page`, `media` | India-aware movie, TV, and anime release calendar |
| GET | `/api/movies/trailers` | — | Trending movie trailers |
| GET | `/api/movies/anime` | — | Popular anime series |
| GET | `/api/movies/hotstar` | — | Popular movies available on Hotstar in India |
| GET | `/api/movies/streaming` | `provider` | Popular movies available from a matching provider in India |
| GET | `/api/movies/mood` | `genre` | Popular movies for a TMDB genre |
| GET | `/api/movies/:tmdbId/community-score` | — | Community verdict counts and score |

The schedule `bucket` is one of `released`, `today`, `upcoming`, or `announced`. `year` must be an integer from 1900 to 2100; `page` is 1–500; `media` is `movie`, `tv`, or `anime`. All public movie and discovery reads are rate limited. Public catalog responses use 60-second browser caching, five-minute shared CDN caching, and stale-while-revalidate. Schedule data additionally uses a ten-minute in-process cache; other TMDB lookups use a five-minute in-process cache. The community score endpoint remains uncached at the CDN because it can reflect access-controlled database rows.

## User movie actions

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/movies/watchlist/me` | Yes | List the current user's watchlist |
| GET | `/api/movies/:tmdbId/me` | Yes | Current user's rating and watchlist state |
| PUT | `/api/movies/:tmdbId/rating` | Yes | Save or update a half-step rating from 0.5–5 |
| PUT | `/api/movies/:tmdbId/watchlist` | Yes | Save or update a watch status |
| DELETE | `/api/movies/:tmdbId/watchlist` | Yes | Remove a watchlist entry |
| PUT | `/api/movies/:tmdbId/verdict` | Yes | Set a community verdict |

All identifiers refer to TMDB IDs. Metadata is fetched from TMDB and cached by the backend; the application does not duplicate the full TMDB catalogue in its database. Search and schedule inputs are validated before upstream requests. Upstream failures return a consistent JSON error response.


## Release schedule ordering and bounds

`GET /api/movies/schedule` accepts `bucket` (`released`, `today`, `upcoming`, or `announced`), `year`, `page` (1–500), and `media` (`movie`, `tv`, or `anime`). Date-driven buckets sort by the earliest release date first; released titles retain popularity ordering. The API caps the reported page count at TMDB's supported 500-page traversal limit. Invalid filters return a structured 400 error.
