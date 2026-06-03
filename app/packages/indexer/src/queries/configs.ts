import { desc } from 'drizzle-orm';
import { pgTables, type SchemaTables, type AnyDb } from '../db/tables.js';

export async function listValidityConfigs(db: AnyDb, limit = 50, t: SchemaTables = pgTables) {
  return db.select().from(t.validityConfigs).orderBy(desc(t.validityConfigs.createdSlot)).limit(limit);
}
