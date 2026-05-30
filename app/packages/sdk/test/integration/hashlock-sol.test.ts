import { describe, it, expect } from 'vitest';
import { Laplace, Condition, fetchIntent } from '../../src/index.js';
import { RUN, localnet, fundedSigner } from './localnet.js';

describe.runIf(RUN)('hashlock SOL lifecycle (localnet)', () => {
  it('create → fulfill → close', async () => {
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
    expect(created.intentPda).toBeTypeOf('string');

    const intent = await fetchIntent(rpc, created.intentPda);
    const fulfilled = await client.fulfillIntent(intent, { secret }, { fulfiller: receiver });
    expect(fulfilled.signature).toBeTypeOf('string');

    const after = await fetchIntent(rpc, created.intentPda);
    const closed = await client.closeIntent(after, { maker });
    expect(closed.signature).toBeTypeOf('string');
  }, 60_000);
});
