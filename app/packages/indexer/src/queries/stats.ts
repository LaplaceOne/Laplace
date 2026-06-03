import { pgTables, type SchemaTables, type AnyDb } from '../db/tables.js';

export interface Stats {
  byStatus: Record<'active' | 'fulfilled' | 'refunded', number>;
  closed: number;
  total: number;
}

export async function stats(db: AnyDb, t: SchemaTables = pgTables): Promise<Stats> {
  const rows = (await db.select().from(t.intents)) as { status: string; closed: boolean }[];
  const byStatus = { active: 0, fulfilled: 0, refunded: 0 };
  let closed = 0;
  for (const r of rows) {
    if (r.status === 'active' || r.status === 'fulfilled' || r.status === 'refunded') byStatus[r.status]++;
    if (r.closed) closed++;
  }
  return { byStatus, closed, total: rows.length };
}
