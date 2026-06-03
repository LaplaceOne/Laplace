import { desc } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { validityConfigs } from '../db/schema.js';

export async function listValidityConfigs(db: Db, limit = 50) {
  return db.select().from(validityConfigs).orderBy(desc(validityConfigs.createdSlot)).limit(limit);
}
