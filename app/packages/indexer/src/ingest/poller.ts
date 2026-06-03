import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { ChainSource } from './rpc.js';
import { decodeTxEvents, type RawTx } from './decode.js';
import { applyEvents } from '../project/fold.js';
import { events as eventsTable, syncState, type EventRow } from '../db/schema.js';

export interface ProgramIds { laplace: string; validity: string }

async function cursor(db: Db, program: string): Promise<string | undefined> {
  const [row] = await db.select().from(syncState).where(eq(syncState.program, program));
  return row?.lastSignature ?? undefined;
}
async function setCursor(db: Db, program: string, signature: string, slot: number): Promise<void> {
  await db.insert(syncState).values({ program, lastSignature: signature, lastSlot: slot, backfilled: true })
    .onConflictDoUpdate({ target: syncState.program, set: { lastSignature: signature, lastSlot: slot } });
}

/** One tail tick: fetch new signatures for both programs, decode, persist events + projections, advance cursors. */
export async function runOnce(db: Db, src: ChainSource, ids: ProgramIds, limit: number): Promise<number> {
  const programs: [keyof ProgramIds, string][] = [['laplace', ids.laplace], ['validity', ids.validity]];
  // collect (program -> newest-first signatures since cursor)
  const perProgram = new Map<keyof ProgramIds, { signature: string; slot: number }[]>();
  for (const [name, addr] of programs) {
    const until = await cursor(db, name);
    const sigs = await src.getSignatures(addr, { until, limit });
    perProgram.set(name, sigs.filter((s) => s.err == null).map((s) => ({ signature: s.signature, slot: s.slot })));
  }
  // dedupe signatures across programs, remember which program first surfaced each (for the cursor)
  const seen = new Set<string>();
  const unique: { program: keyof ProgramIds; signature: string; slot: number }[] = [];
  for (const [name] of programs) {
    for (const s of perProgram.get(name) ?? []) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);
      unique.push({ program: name, signature: s.signature, slot: s.slot });
    }
  }
  // process oldest -> newest
  unique.sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature));
  let count = 0;
  for (const u of unique) {
    const tx: RawTx | null = await src.getTx(u.signature);
    if (!tx) continue;
    const rows: EventRow[] = decodeTxEvents(tx, u.program);
    if (rows.length) {
      await db.insert(eventsTable).values(rows).onConflictDoNothing();
      await applyEvents(db, rows);
      count += rows.length;
    }
  }
  // advance each program cursor to its newest signature this tick
  for (const [name] of programs) {
    const list = perProgram.get(name) ?? [];
    const newest = list.reduce<{ signature: string; slot: number } | null>((m, s) => (m && m.slot >= s.slot ? m : s), null);
    if (newest) await setCursor(db, name, newest.signature, newest.slot);
  }
  return count;
}
