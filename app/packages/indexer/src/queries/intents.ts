import { and, asc, desc, eq, lt, type SQL } from 'drizzle-orm';
import type { IntentRow } from '../db/schema.js';
import { pgTables, type SchemaTables, type AnyDb } from '../db/tables.js';

export interface IntentFilter {
  status?: string;
  maker?: string;
  receiver?: string;
  criterionProgram?: string;
  limit: number;
  cursorSlot?: number;
}

export async function listIntents(db: AnyDb, f: IntentFilter, t: SchemaTables = pgTables): Promise<IntentRow[]> {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(t.intents.status, f.status));
  if (f.maker) conds.push(eq(t.intents.maker, f.maker));
  if (f.receiver) conds.push(eq(t.intents.receiver, f.receiver));
  if (f.criterionProgram) conds.push(eq(t.intents.criterionProgram, f.criterionProgram));
  if (f.cursorSlot != null) conds.push(lt(t.intents.createdSlot, f.cursorSlot));
  return db
    .select()
    .from(t.intents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.intents.createdSlot))
    .limit(f.limit);
}

export interface IntentDetail {
  intent: IntentRow;
  timeline: { kind: string; signature: string; slot: number }[];
}

export async function getIntent(db: AnyDb, pda: string, t: SchemaTables = pgTables): Promise<IntentDetail | null> {
  const [row] = await db.select().from(t.intents).where(eq(t.intents.pda, pda));
  if (!row) return null;
  const tl = await db
    .select({ kind: t.events.kind, signature: t.events.signature, slot: t.events.slot })
    .from(t.events)
    .where(eq(t.events.intentPda, pda))
    .orderBy(asc(t.events.slot), asc(t.events.eventIndex));
  return { intent: row, timeline: tl };
}
