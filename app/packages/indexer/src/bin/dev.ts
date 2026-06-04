// Combined single-process indexer for local / devnet use: ingest loop + read API sharing one
// in-process pglite DB. (The split `laplace-indexer` + `laplace-indexer-api` bins are for
// production, where they share an external Postgres via DATABASE_URL=postgres://…)
//
//   LAPLACE_CLUSTER=devnet DATABASE_URL=file:./devnet-index.db API_PORT=8787 laplace-indexer-dev
//
import { serve } from '@hono/node-server';
import { createSolanaRpc } from '@solana/kit';
import { getCluster } from '@laplace-one/registry';
import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { createApi } from '../api/server.js';
import { rpcSource } from '../ingest/rpc.js';
import { runOnce, type ProgramIds } from '../ingest/poller.js';

async function main() {
  const cfg = loadConfig();
  const { programs } = getCluster(cfg.cluster);
  const ids: ProgramIds = { laplace: programs.laplace, validity: programs.validity };

  const { db, migrate } = await makeDb(cfg.databaseUrl);
  await migrate();

  // Read API (shares the same in-process db handle as the ingester below).
  const app = createApi(db);
  serve({ fetch: app.fetch, port: cfg.apiPort });
  // eslint-disable-next-line no-console
  console.log(`[indexer-dev] API on :${cfg.apiPort} · ingesting ${cfg.cluster} (${cfg.rpcUrl}) every ${cfg.pollIntervalMs}ms`);

  // Ingest loop.
  const src = rpcSource(createSolanaRpc(cfg.rpcUrl), cfg.commitment);
  for (;;) {
    try {
      const n = await runOnce(db, src, ids, 1000);
      // eslint-disable-next-line no-console
      if (n) console.log(`[indexer-dev] ingested ${n} events`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[indexer-dev] tick failed, backing off', err);
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}

main();
