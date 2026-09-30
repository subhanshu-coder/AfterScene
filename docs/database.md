# Database

Apply migrations using the Supabase CLI from the repository root after linking a development project: `supabase link --project-ref <development-project>` and `supabase db push`. Keep production in a separate Supabase project. Do not make undocumented dashboard schema changes.

The initial migration creates profiles and preferences from Supabase Auth signup, movie metadata keyed by TMDB ID, ratings, social posts and reactions, comments, reviews and helpful votes, follows and blocks, watchlists, history, collections, notifications, and Movie DNA snapshots. Relationships use foreign keys and cascade when the owning user or content is deleted. Feed and profile access should remain paginated as their APIs are implemented.

RLS is enabled on every application table. User-owned rows are scoped to `auth.uid()`. Public movie facts and public social content are readable under their table policies. Private profile visibility is constrained at profile reads. The API uses the service-role key only after token verification; never ship it to the browser.

The migration is an initial model. Before production, run it on a clean Supabase project and review every policy with anon, authenticated, moderator, and admin identities. Add retention and account deletion procedures before collecting real user content.
