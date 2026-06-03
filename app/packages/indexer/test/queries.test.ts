import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { applyEvents } from '../src/project/fold.js';
import { listIntents, getIntent } from '../src/queries/intents.js';
import { stats } from '../src/queries/stats.js';
import type { EventRow } from '../src/db/schema.js';

const base = { eventIndex: 0, blockTime: 1, program: 'laplace' as const, configPda: null };
function ev(kind: string, slot: number, sig: string, intentPda: string, payload: Record<string, unknown>): EventRow {
  return { ...base, signature: sig, slot, kind, intentPda, payload } as EventRow;
}
function created(pda: string, maker: string, amount: string, slot: number): EventRow {
  return ev('IntentCreated', slot, `c${pda}`, pda, { intent: pda, id: 'aa', maker, receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount, expirySlot: '99', createdSlot: String(slot) });
}

describe('queries', () => {
  it('lists/filters intents, returns a timeline, and aggregates stats', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await applyEvents(db, [
      created('P1', 'M1', '100', 1),
      created('P2', 'M2', '250', 2),
      ev('IntentFulfilled', 3, 'f', 'P1', { intent: 'P1', amount: '100', slot: '3' }),
    ]);
    // also persist events for the timeline join
    const { events: eventsTable } = await import('../src/db/schema.js');
    await db.insert(eventsTable).values([created('P1', 'M1', '100', 1), ev('IntentFulfilled', 3, 'f', 'P1', { intent: 'P1', amount: '100', slot: '3' })]);

    const all = await listIntents(db, { limit: 10 });
    expect(all.length).toBe(2);
    const byMaker = await listIntents(db, { maker: 'M2', limit: 10 });
    expect(byMaker.map((i) => i.pda)).toEqual(['P2']);

    const one = await getIntent(db, 'P1');
    expect(one?.intent.status).toBe('fulfilled');
    expect(one?.timeline.length).toBe(2);

    const s = await stats(db);
    expect(s.byStatus.active).toBe(1);
    expect(s.byStatus.fulfilled).toBe(1);
    await close();
  });
});
