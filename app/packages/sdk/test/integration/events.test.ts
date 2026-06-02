import { describe, it, expect } from 'vitest';
import { Laplace, Condition } from '../../src/index.js';
import { fetchAndParseEvents } from '../../src/events.js';
import { RUN, localnet, fundedSigner } from './localnet.js';

// Proves the hand-written decoder matches REAL on-chain event bytes (not just self-consistency).
// Mirrors the harness used by hashlock-sol.test.ts: localnet() rpc + a funded maker/receiver and a
// hashlock createIntent. Skips entirely when LAPLACE_LOCALNET is unset.
describe.runIf(RUN)('events (localnet)', () => {
  it('decodes IntentCreated from a real createIntent transaction', async () => {
    const { rpc, rpcSubscriptions } = localnet();
    const client = new Laplace({ rpc, rpcSubscriptions, cluster: 'localnet' });
    const maker = await fundedSigner(rpc, rpcSubscriptions);
    const receiver = await fundedSigner(rpc, rpcSubscriptions);
    const secret = new Uint8Array(32).fill(42);
    const slot = await rpc.getSlot().send();

    const created = await client.createIntent({
      maker, receiver: receiver.address, asset: { sol: true }, amount: 1_000_000_000n,
      criterion: Condition.hashlock({ secret }), expirySlot: slot + 10_000n,
    });

    const events = await fetchAndParseEvents(rpc, created.signature);
    const intentCreated = events.find((e) => e.kind === 'IntentCreated');
    expect(intentCreated).toBeDefined();
    expect(intentCreated!.intent).toBe(created.intentPda);
    expect(intentCreated!.maker).toBe(maker.address);
  }, 60_000);
});
