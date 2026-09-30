# AI architecture

No AI provider is called in the current slice. Recommendation ranking should first use stored preferences, ratings, watch history, and community signals, then optionally request an explanation from an interchangeable provider interface. AI must not invent movies: candidate titles must come from TMDB-backed records and the explanation must use those candidates.

Keep structured taste data in Postgres and avoid retaining private copilot conversations unless a user explicitly saves them. Add request quotas, prompt limits, response caching, and user approval before generated review text is published. Spoiler analysis should warn and let the author choose; it must not silently rewrite posts.
