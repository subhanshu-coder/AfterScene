# Security

- Keep TMDB and Supabase service-role keys in backend environment variables only.
- The browser receives only the Supabase URL and anon key; PostgreSQL RLS remains mandatory.
- API writes verify the caller’s Supabase access token before using the service role.
- Helmet, same-origin CORS, bounded JSON bodies, request IDs, and search rate limits are enabled.
- Passwords are handled by Supabase Auth and never stored by Afterscene.
- User text fields are bounded in both SQL constraints and API validation where implemented.

Before launch, complete security review for all new endpoints and RLS policies, configure production CORS origins, set provider key rotation, validate image uploads, and add abuse controls for social writes and AI requests. Do not grant the service role to clients or CI pull-request builds.
