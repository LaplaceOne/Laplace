import { createSolanaRpc } from '@solana/kit';
import { getCluster } from '@laplace-one/registry';
import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { rpcSource } from '../ingest/rpc.js';
import { runOnce, type ProgramIds } from '../ingest/poller.js';

async function main() {
  const cfg = loadConfig();
  const { programs } = getCluster(cfg.cluster);
  const ids: ProgramIds = { laplace: programs.laplace, validity: programs.validity };
  const { db, migrate } = await makeDb(cfg.databaseUrl);
  await migrate();
  const src = rpcSource(createSolanaRpc(cfg.rpcUrl), cfg.commitment);
  // eslint-disable-next-line no-console
  console.log(`[indexer] ${cfg.cluster} ${cfg.rpcUrl} every ${cfg.pollIntervalMs}ms`);
  for (;;) {
    try {
      const n = await runOnce(db, src, ids, 1000);
      if (n) console.log(`[indexer] ingested ${n} events`);
    } catch (err) {
      console.error('[indexer] tick failed, backing off', err);
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}
main();
