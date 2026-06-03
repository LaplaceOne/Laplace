import { serve } from '@hono/node-server';
import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { createApi } from '../api/server.js';

async function main() {
  const cfg = loadConfig();
  const { db, migrate } = await makeDb(cfg.databaseUrl);
  await migrate();
  const app = createApi(db);
  serve({ fetch: app.fetch, port: cfg.apiPort });
  // eslint-disable-next-line no-console
  console.log(`[indexer-api] listening on :${cfg.apiPort}`);
}
main();
