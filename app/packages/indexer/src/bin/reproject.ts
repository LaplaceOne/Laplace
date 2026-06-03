import { loadConfig } from '../config.js';
import { makeDb } from '../db/client.js';
import { reproject } from '../project/fold.js';

async function main() {
  const cfg = loadConfig();
  const { db, migrate, close } = await makeDb(cfg.databaseUrl);
  await migrate();
  await reproject(db);
  await close();
  // eslint-disable-next-line no-console
  console.log('[reproject] projections rebuilt from events');
}
main();
