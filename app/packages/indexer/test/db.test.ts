import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { events } from '../src/db/schema.js';

describe('makeDb (pglite)', () => {
  it('migrates an in-memory db and round-trips an event row', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await db.insert(events).values({
      signature: 'sig1', eventIndex: 0, slot: 10, blockTime: 1700000000,
      program: 'laplace', kind: 'IntentCreated', intentPda: 'pda1', configPda: null,
      payload: { amount: '5' },
    });
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('IntentCreated');
    await close();
  });
});
