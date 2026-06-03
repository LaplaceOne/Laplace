// Driver-free indexer core: event decode, polling, projection, queries, and the read API —
// all schema-parameterized so the SAME logic serves Postgres (Node) and SQLite/D1 (the Cloudflare
// Worker). Deliberately EXCLUDES makeDb + loadConfig, which pull Node/Postgres drivers (pglite,
// postgres.js) that don't run on Workers. The CF worker imports from here and passes its D1 tables.
export * from './ingest/decode.js';
export * from './ingest/rpc.js';
export * from './ingest/poller.js';
export * from './project/fold.js';
export * from './queries/intents.js';
export * from './queries/stats.js';
export * from './queries/configs.js';
export { createApi } from './api/server.js';
export * from './db/tables.js';
export type { EventRow, IntentRow } from './db/schema.js';
