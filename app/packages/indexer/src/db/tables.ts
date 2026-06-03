import { events, intents, validityConfigs, syncState } from './schema.js';

/**
 * The set of drizzle tables the indexer logic touches. Typed loosely so BOTH the Postgres tables
 * (Node) and the SQLite/D1 tables (the CF Worker) fit — the query-builder calls are identical
 * across dialects, only the table/db TYPES differ. This lets one set of projection/query functions
 * serve both backends (see `@laplace/indexer/core`).
 */
export interface SchemaTables {
  events: any;
  intents: any;
  validityConfigs: any;
  syncState: any;
}

/** Default (Postgres) tables — used by the Node path so its public API stays `(db, …)`. */
export const pgTables: SchemaTables = { events, intents, validityConfigs, syncState };

/**
 * A drizzle database, loosely typed. `PgDatabase` and `BaseSQLiteDatabase` expose the same
 * query-builder surface but as distinct types that don't unify, so the shared functions accept any.
 */
export type AnyDb = any;
