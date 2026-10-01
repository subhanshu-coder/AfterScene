# Contributing

Use small feature branches and open pull requests into `develop`; promote reviewed changes from `develop` to `main` after CI passes. Add schema changes as forward migrations and include tests for new API behavior. Keep movie provider keys and Supabase service credentials out of commits, screenshots, logs, and client bundles.

Run `corepack pnpm install`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build` before opening a pull request. Docker Compose is available for local integration with hosted Supabase credentials.
