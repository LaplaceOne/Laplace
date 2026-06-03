import { eq } from 'drizzle-orm';
import type { ChainSource } from './rpc.js';
import { decodeTxEvents, type RawTx } from './decode.js';
import { applyEvents } from '../project/fold.js';
import type { EventRow } from '../db/schema.js';
import { pgTables, type SchemaTables, type AnyDb } from '../db/tables.js';

export interface ProgramIds {
  laplace: string;
  validity: string;
}

async function cursor(db: AnyDb, program: string, t: SchemaTables): Promise<string | undefined> {
  const [row] = await db.select().from(t.syncState).where(eq(t.syncState.program, program));
  return row?.lastSignature ?? undefined;
}
async function setCursor(db: AnyDb, program: string, signature: string, slot: number, t: SchemaTables): Promise<void> {
  await db
    .insert(t.syncState)
    .values({ program, lastSignature: signature, lastSlot: slot, backfilled: true })
    .onConflictDoUpdate({ target: t.syncState.program, set: { lastSignature: signature, lastSlot: slot } });
}

/** One tail tick: fetch new signatures for both programs, decode, persist events + projections,
 *  advance cursors. `t` selects the dialect's tables (defaults to Postgres). */
export async function runOnce(
  db: AnyDb,
  src: ChainSource,
  ids: ProgramIds,
  limit: number,
  t: SchemaTables = pgTables,
): Promise<number> {
  const programs: [keyof ProgramIds, string][] = [
    ['laplace', ids.laplace],
    ['validity', ids.validity],
  ];
  const perProgram = new Map<keyof ProgramIds, { signature: string; slot: number }[]>();
  for (const [name, addr] of programs) {
    const until = await cursor(db, name, t);
    const sigs = await src.getSignatures(addr, { until, limit });
    perProgram.set(name, sigs.filter((s) => s.err == null).map((s) => ({ signature: s.signature, slot: s.slot })));
  }

  const seen = new Set<string>();
  const unique: { program: keyof ProgramIds; signature: string; slot: number }[] = [];
  for (const [name] of programs) {
    for (const s of perProgram.get(name) ?? []) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);
      unique.push({ program: name, signature: s.signature, slot: s.slot });
    }
  }
  unique.sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature));

  let count = 0;
  for (const u of unique) {
    const tx: RawTx | null = await src.getTx(u.signature);
    if (!tx) continue;
    const rows: EventRow[] = decodeTxEvents(tx, u.program);
    if (rows.length) {
      await db.insert(t.events).values(rows).onConflictDoNothing();
      await applyEvents(db, rows, t);
      count += rows.length;
    }
  }

  for (const [name] of programs) {
    const list = perProgram.get(name) ?? [];
    const newest = list.reduce<{ signature: string; slot: number } | null>(
      (m, s) => (m && m.slot >= s.slot ? m : s),
      null,
    );
    if (newest) await setCursor(db, name, newest.signature, newest.slot, t);
  }
  return count;
}
