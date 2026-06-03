# @laplace/indexer

Ingests Laplace lifecycle events into Postgres and serves typed reads.

## Env
- `LAPLACE_CLUSTER` (default `devnet`), `LAPLACE_RPC_URL` (default from registry)
- `DATABASE_URL` — `postgres://…` (prod), `memory://` (default, ephemeral pglite), or `file:./data` (pglite on disk)
- `POLL_INTERVAL_MS` (default 5000), `START_SLOT`, `COMMITMENT` (default `finalized`), `API_PORT` (default 8787)

## Run
- Ingest worker: `node dist/bin/indexer.js`  (or `npx laplace-indexer`)
- Read API:      `node dist/bin/api.js`       (or `npx laplace-indexer-api`)
- Rebuild projections from events: `node dist/bin/reproject.js`

Generate migrations after a schema change: `npm run db:generate`.
