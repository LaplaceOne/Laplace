import { and, asc, desc, eq, lt, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { intents, events as eventsTable, type IntentRow } from '../db/schema.js';

export interface IntentFilter {
  status?: string; maker?: string; receiver?: string; criterionProgram?: string;
  limit: number; cursorSlot?: number;
}

export async function listIntents(db: Db, f: IntentFilter): Promise<IntentRow[]> {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(intents.status, f.status));
  if (f.maker) conds.push(eq(intents.maker, f.maker));
  if (f.receiver) conds.push(eq(intents.receiver, f.receiver));
  if (f.criterionProgram) conds.push(eq(intents.criterionProgram, f.criterionProgram));
  if (f.cursorSlot != null) conds.push(lt(intents.createdSlot, f.cursorSlot));
  return db.select().from(intents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(intents.createdSlot))
    .limit(f.limit);
}

export interface IntentDetail { intent: IntentRow; timeline: { kind: string; signature: string; slot: number }[] }

export async function getIntent(db: Db, pda: string): Promise<IntentDetail | null> {
  const [row] = await db.select().from(intents).where(eq(intents.pda, pda));
  if (!row) return null;
  const tl = await db.select({ kind: eventsTable.kind, signature: eventsTable.signature, slot: eventsTable.slot })
    .from(eventsTable).where(eq(eventsTable.intentPda, pda)).orderBy(asc(eventsTable.slot), asc(eventsTable.eventIndex));
  return { intent: row, timeline: tl };
}
