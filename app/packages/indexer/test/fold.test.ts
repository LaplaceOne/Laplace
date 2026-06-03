import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { applyEvents } from '../src/project/fold.js';
import { intents } from '../src/db/schema.js';
import type { EventRow } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const base = { signature: 's', eventIndex: 0, slot: 1, blockTime: 1, program: 'laplace' as const, configPda: null };
function ev(kind: string, slot: number, sig: string, payload: Record<string, unknown>): EventRow {
  return { ...base, signature: sig, slot, kind, intentPda: 'P', payload } as EventRow;
}

describe('applyEvents', () => {
  it('folds create→fulfill→close into one intent row', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await applyEvents(db, [
      ev('IntentCreated', 1, 'c', { intent: 'P', id: 'aa', maker: 'M', receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount: '500', expirySlot: '99', createdSlot: '1' }),
      ev('IntentFulfilled', 2, 'f', { intent: 'P', amount: '500', slot: '2' }),
      ev('IntentClosed', 3, 'x', { intent: 'P', finalStatus: 1, slot: '3' }),
    ]);
    const [row] = await db.select().from(intents).where(eq(intents.pda, 'P'));
    expect(row?.status).toBe('fulfilled');
    expect(row?.closed).toBe(true);
    expect(row?.amount).toBe('500');
    expect(row?.settledSlot).toBe(2);
    await close();
  });

  it('is idempotent (folding twice equals once)', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    const seq = [
      ev('IntentCreated', 1, 'c', { intent: 'P', id: 'aa', maker: 'M', receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount: '1', expirySlot: '9', createdSlot: '1' }),
      ev('IntentRefunded', 5, 'r', { intent: 'P', amount: '1', slot: '5' }),
    ];
    await applyEvents(db, seq);
    await applyEvents(db, seq);
    const rows = await db.select().from(intents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('refunded');
    await close();
  });
});
