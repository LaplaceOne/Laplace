import { describe, it, expect } from 'vitest';
import { makeDb } from '../src/db/client.js';
import { applyEvents } from '../src/project/fold.js';
import { createApi } from '../src/api/server.js';
import type { EventRow } from '../src/db/schema.js';

function created(pda: string, maker: string, amount: string, slot: number): EventRow {
  return { signature: `c${pda}`, eventIndex: 0, slot, blockTime: 1, program: 'laplace', kind: 'IntentCreated', intentPda: pda, configPda: null,
    payload: { intent: pda, id: 'aa', maker, receiver: 'R', refundRecipient: 'F', criterionProgram: 'C', criterionDataHash: 'bb', criterionInterfaceVersion: 2, asset: { __kind: 'NativeSol' }, amount, expirySlot: '99', createdSlot: String(slot) } } as EventRow;
}

describe('read API', () => {
  it('serves /health, /intents, /intents/:pda, /stats', async () => {
    const { db, migrate, close } = await makeDb('memory://');
    await migrate();
    await applyEvents(db, [created('P1', 'M1', '100', 1)]);
    const app = createApi(db);

    expect((await app.request('/health')).status).toBe(200);

    const list = await (await app.request('/intents')).json();
    expect(list.intents.length).toBe(1);
    expect(list.intents[0].amount).toBe('100');

    const one = await (await app.request('/intents/P1')).json();
    expect(one.intent.pda).toBe('P1');

    const stats = await (await app.request('/stats')).json();
    expect(stats.total).toBe(1);

    expect((await app.request('/intents/NOPE')).status).toBe(404);
    await close();
  });
});
