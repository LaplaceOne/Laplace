# @laplace/indexer-worker

The Laplace indexer as an **all-Cloudflare** deployment: a Worker with **D1** (SQLite) storage.

- **`fetch`** serves the read API (`/health`, `/intents`, `/intents/:pda`, `/stats`, `/validity-configs`) — same shapes as `@laplace/indexer`.
- **`scheduled`** (cron) runs one ingest tick (`runOnce`) — replacing the Node poller's infinite loop.

**No duplicated logic:** the projection, poller, queries, and API all come from
`@laplace/indexer/core` (schema-parameterized) — the *same* code the Node/Postgres indexer runs.
This worker only adds the **SQLite schema** (`src/schema.ts`), the **D1 client** (`src/db.ts`), and
the **entry** (`src/index.ts`), which passes the D1 tables into the shared core.

## Deploy

`wrangler.toml` is a committed **template** (config only, placeholder `database_id`, no secrets).
This is a public repo, so keep real resource ids out of git: deploy from a **gitignored
`wrangler.prod.toml`** (copy of `wrangler.toml` with the real id). Secrets (e.g. an RPC URL with an
API key) go via `wrangler secret put` — never in any committed file.

From `app/apps/indexer-worker/`:

```bash
cp wrangler.toml wrangler.prod.toml                 # gitignored — your real ids live here
npx wrangler login

# 1. Create the D1 database, then paste its id into wrangler.prod.toml (database_id).
npx wrangler d1 create laplace-indexer

# 2. Apply the schema migration to the remote D1.
npx wrangler d1 migrations apply laplace-indexer --remote -c wrangler.prod.toml

# 3. (Recommended) set a dedicated RPC as a SECRET (encrypted; else the public devnet RPC is used).
npx wrangler secret put LAPLACE_RPC_URL -c wrangler.prod.toml   # e.g. https://devnet.helius-rpc.com/?api-key=…

# 4. Deploy (registers the cron trigger too).
npx wrangler deploy -c wrangler.prod.toml
```

Then point the frontend at it: set the Pages/Vite env `VITE_INDEXER_URL` to the deployed Worker
URL (e.g. `https://laplace-indexer.<account>.workers.dev`).

> **What's safe to commit:** `wrangler.toml` config + `[vars]` (non-secret, e.g. `LAPLACE_CLUSTER`)
> are fine. `database_id`/`account_id` are *identifiers*, not credentials, but we keep them in the
> gitignored `wrangler.prod.toml` anyway. Secrets always go through `wrangler secret put` (deployed)
> or `.dev.vars` (local, gitignored) — never a tracked file.

## Config (`wrangler.toml`)

- `[[d1_databases]] binding = "DB"` — the D1 database (set `database_id`).
- `[triggers] crons = ["*/2 * * * *"]` — ingest cadence (every 2 min).
- `[vars] LAPLACE_CLUSTER` — `devnet` by default; `LAPLACE_RPC_URL` via secret.
- `compatibility_flags = ["nodejs_compat"]` — required (the SDK/kit reference `process`).

## Local dev

```bash
npx wrangler dev --local        # serves the Worker; --local uses a local D1
# apply migrations to the local D1 first:
npx wrangler d1 migrations apply laplace-indexer --local
```

## Backfill / reproject

The cron tails new signatures from the last cursor. To rebuild projections from the immutable
`events` table after a logic change, run `reproject(makeDb(env.DB), TABLES)` (from
`@laplace/indexer/core`) — e.g. via a temporary admin route.
