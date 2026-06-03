import { createSolanaRpc } from '@solana/kit';
import { getCluster, type Cluster } from '@laplace/registry';
import { createApi, runOnce, rpcSource, type ProgramIds, type SchemaTables } from '@laplace/indexer/core';
import { makeDb } from './db.js';
import { events, intents, validityConfigs, syncState } from './schema.js';

export interface Env {
  DB: D1Database;
  LAPLACE_CLUSTER?: string;
  LAPLACE_RPC_URL?: string;
}

// The D1 (SQLite) tables, handed to the SHARED indexer logic in @laplace/indexer/core — the same
// projection/poller/query/API code that the Node (Postgres) path uses, just bound to D1's tables.
const TABLES: SchemaTables = { events, intents, validityConfigs, syncState };

export default {
  // Read API — Hono handles all routes (/health, /intents, /stats, /validity-configs).
  async fetch(req: Request, env: Env): Promise<Response> {
    return createApi(makeDb(env.DB), TABLES).fetch(req);
  },

  // Ingest — one poll tick per cron trigger (replaces the Node poller's infinite loop).
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const cluster = (env.LAPLACE_CLUSTER ?? 'devnet') as Cluster;
    const { programs, rpcUrl } = getCluster(cluster);
    const src = rpcSource(createSolanaRpc(env.LAPLACE_RPC_URL ?? rpcUrl), 'confirmed');
    const ids: ProgramIds = { laplace: programs.laplace, validity: programs.validity };
    const n = await runOnce(makeDb(env.DB), src, ids, 200, TABLES);
    if (n) console.log(`[indexer-worker] ingested ${n} events`);
  },
} satisfies ExportedHandler<Env>;
