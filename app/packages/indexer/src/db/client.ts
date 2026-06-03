import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

function isPostgres(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

/** Build a Drizzle db. `postgres://…` → postgres.js; `memory://` → in-memory pglite; `file:PATH` → pglite on disk. */
export async function makeDb(databaseUrl: string): Promise<{ db: Db; migrate: () => Promise<void>; close: () => Promise<void> }> {
  if (isPostgres(databaseUrl)) {
    const client = postgres(databaseUrl, { max: 4 });
    const db = drizzlePg(client, { schema }) as unknown as Db;
    return { db, migrate: () => migratePg(db as never, { migrationsFolder: MIGRATIONS }), close: async () => { await client.end(); } };
  }
  const dataDir = databaseUrl === 'memory://' || databaseUrl === '' ? undefined : databaseUrl.replace(/^file:/, '');
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return { db, migrate: () => migratePglite(db as never, { migrationsFolder: MIGRATIONS }), close: async () => { await client.close(); } };
}
